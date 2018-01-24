#!/usr/bin/env node

"use strict";
var debug =  require("debug")("tile-squirrel-add-tile-list"),
  QueueWriter =  require("../lib/queueWriter");

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

new QueueWriter(opts.sources, {}, function(err, queueWriter) {
  var pipe = process.stdin.pipe(require('split')());
  pipe.on('data', function(line) {
    if(line.length) {
      queueWriter.putTile(line);
    }
  });
  pipe.on('end', function() {
    queueWriter.tileStream.end();
  });
});
