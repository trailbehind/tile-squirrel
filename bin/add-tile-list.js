#!/usr/bin/env node

"use strict";
var debug = debug = require("debug")("tile-squirrel-add-tile-list"),
  SphericalMercator = require("SphericalMercator");

var nomnom = require("nomnom")
  .options({
    sources: {
      position: 0,
      help: "source names to queue",
      list: true
    },
    file: {
      abbr: "f",
      metavar: "FILE",
      help: "Read list from file. By default list is read from STDIN"
    },
    version: {
      abbr: "v",
      flag: true,
      help: "Show version info",
      callback: function() {
        return "tile-squirrel v" + require("../package.json").version;
      }
    }
  })
  .help("Read a list of tiles to queue for rendering.");

var opts = nomnom.parse();

if(!opts.sources || opts.sources.length == 0) {
  console.log("At least 1 source name is required.");
  process.exit(-1);
}

var tiles = [];

var pipe = process.stdin.pipe(require('split')());
pipe.on('data', processLine);
pipe.on('finish', postTiles);
pipe.on('end', postTiles);

function processLine (line) {
  if(line.length) {
    tiles.push(line);
  }
}

function postTiles () {
  debug("postTiles");
  postTileList(tiles, opts.sources);
  tiles = [];
}

function postTileList(tiles, sources) {
  debug("post tile list", tiles, sources);
  var context = require('rabbit.js').createContext('amqp://localhost');
  context.on('ready', function() {
    var pub = context.socket('PUSH');
    pub.connect('tiles', function() {
      for(var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
        var sourceName = sources[sourceIndex];
        for(var i = 0; i < tiles.length; i++) {
          pub.write(sourceName + "+" + tiles[i], 'utf8');      
        }
      }
      setTimeout(function() {
          process.exit(0)
      }, 1);
    });
  });
};
