"use strict";

module.exports = QueueWriter;

var debug = require("debug")("tile-squirrel-queueWriter"),
  rabbit = require('rabbit.js'),
  Writable = require('stream').Writable;

function QueueWriter(sources, opts, callback) {
  var context = rabbit.createContext('amqp://localhost');
  var tileStream = Writable();
  this.tileStream = tileStream;
  var qw = this;

  context.on('ready', function() {
    debug("Connected to context");
    var pub = context.socket('PUSH');
    pub.connect('tiles', function() {
      debug("Connected to socket");
      tileStream._write = function (chunk, enc, next) {
        for(var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
          var message = sources[sourceIndex] + "+" + chunk;
          pub.write(message, 'utf8');
          debug("Queueing " + message);
        }
        next();
      };
      //Finish needs to be setup here, if it is setup before the socket is connected,
      // and end is called before the connection happens then writes will never happen
      tileStream.on('finish', function() {
        debug("tileStream finished");
        setTimeout(function() {
          debug("Exiting");
          process.exit(0)
        }, 1000);
      });
      callback(null, qw);
    });
  });
};

QueueWriter.prototype.putTile = function(tile) {
  debug("putTile " + tile);
  this.tileStream.write(tile);
};
