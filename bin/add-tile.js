#!/usr/bin/env node

"use strict";

var debug =  require("debug")("tile-squirrel-add-tile"),
  QueueWriter =  require("../lib/queueWriter"),
  path = require("path");


var nomnom = require("nomnom")
  .options({
    source: {
      position: 0,
      help: "Source to queue",
    },
    tile: {
      position: 1,
      help: "Tile to queue",
    },
    config: {
      abbr: "c",
      metavar: "CONFIG",
      help: "Provide a configuration file. Configuration file is not needed," + 
      " but if it is provided sources will be verified to exist in config."
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
  .help("Queue a single tile");

var opts = nomnom.parse();

if(!opts.source || !opts.tile) {
    nomnom.print(nomnom.getUsage());
}

//Check if source exists if a config was specified
if(opts.config) {
  var config = require(path.resolve(opts.config));
  if(!config[opts.source]) {
    console.log("Source " + opts.source + " not found in config");
    process.exit(-1);
  }
}

new QueueWriter([opts.source], {}, function(err, queueWriter) {
  queueWriter.putTile(opts.tile, function(){
    queueWriter.tileStream.end();
  });
});
