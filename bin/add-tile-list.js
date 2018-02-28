#!/usr/bin/env node

"use strict";
var debug = require("debug")("tile-squirrel-add-tile-list"),
  QueueWriter = require("../lib/queueWriter");

var nomnom = require("nomnom")
  .options({
    sources: {
      position: 0,
      help: "source names to queue",
      list: true
    },
    dryRun: {
      abbr: "d",
      flag: true,
      help: "Dry run. Don't actually add messages to queue."
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

if (!opts.sources || opts.sources.length == 0) {
  console.log("At least 1 source name is required.");
  process.exit(-1);
}

new QueueWriter(opts.sources, { dryRun: opts.dryRun }, function(err, queueWriter) {
  var pipe = process.stdin.pipe(require("split")());
  pipe.on("data", function(line) {
    if (line.length) {
      pipe.pause();
      queueWriter.putTile(line, function() {
        pipe.resume();
      });
    }
  });
  pipe.on("end", function() {
    queueWriter.tileStream.end();
  });
});
