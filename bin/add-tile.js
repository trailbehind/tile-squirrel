#!/usr/bin/env node

"use strict";

var debug =  require("debug")("tile-squirrel-add-tile"),
  QueueWriter =  require("../lib/queueWriter");

new QueueWriter([process.argv[2]], {}, function(err, queueWriter) {
    queueWriter.putTile(process.argv[3]);
    queueWriter.tileStream.end();
});
