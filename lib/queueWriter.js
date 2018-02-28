"use strict";

module.exports = QueueWriter;

var debug = require("debug")("tile-squirrel-queueWriter"),
  rabbit = require("rabbit.js"),
  Writable = require("stream").Writable;

function QueueWriter(sources, opts, callback) {
  var ampqHost = process.env.AMPQ_HOST || "localhost";
  var server = "amqp://" + ampqHost;
  var ampqTopic = process.env.AMPQ_TOPIC || "tiles";

  var context = rabbit.createContext(server);
  var tileStream = Writable();
  this.tileStream = tileStream;
  this.dryRun = opts.dryRun || false;
  var retryDelay = opts.retryDelay || 1000;
  var qw = this;
  debug("Connecting to " + server + "/" + ampqTopic);

  context.on("ready", function() {
    debug("Connected to context");
    var pub = context.socket("PUSH");
    pub.connect(ampqTopic, function() {
      debug("Connected to socket");
      var tilestreamWrite = function(chunk, enc, next, retries) {
        var success = true;
        for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
          var message = sources[sourceIndex] + "+" + chunk;
          debug("Queueing " + message);
          if (!pub.write(message, "utf8")) {
            success = false;
            if (retries === undefined) {
              retries = 0;
            }
            console.log("Error writing to queue, retrying after delay. retry count:" + retries);
            setTimeout(function() {
              tilestreamWrite(chunk, enc, next, retries + 1);
            }, retryDelay);
            break;
          }
        }
        if (success) {
          next();
        }
      };
      tileStream._write = tilestreamWrite;
      //Finish needs to be setup here, if it is setup before the socket is connected,
      // and end is called before the connection happens then writes will never happen
      tileStream.on("finish", function() {
        debug("tileStream finished");
        pub.close();
        setTimeout(function() {
          debug("Exiting");
          process.exit(0);
        }, 1000);
      });
      callback(null, qw);
    });
  });
}

QueueWriter.prototype.putTile = function(tile, callback) {
  if (!this.dryRun) {
    if (!this.tileStream.write(tile)) {
      debug("Draining queue");
      this.tileStream.once("drain", callback);
    } else {
      process.nextTick(callback);
    }
  } else {
    debug("putTile(dryRun) " + tile);
    process.nextTick(callback);
  }
};
