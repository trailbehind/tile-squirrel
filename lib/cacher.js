#!/usr/bin/env node
"use strict";

var path = require("path"),
  debug = require("debug"),
  rabbit = require("rabbit.js"),
  Q = require("q");

debug = debug("tile-squirrel-cacher");

module.exports = function(opts) {
  var tilelive = require("tilelive");

  // load and register tilelive modules
  require("tilelive-modules/loader")(tilelive, opts);

  //Load all sources
  var sources = {};
  var sinks = {};

  var config = require(path.resolve(opts.config));
  if (opts.defer) {
    start();
  } else {
    debug("Loading " + Object.keys(config).length + " sources");
    var sourceLoadingPromises = [];
    Object.keys(config).forEach(function(key) {
      (function() {
        var deferred = Q.defer();
        sourceLoadingPromises.push(deferred.promise);
        tilelive.load(config[key]["source"], function(err, src) {
          if (err) {
            console.log("Error loading source " + config[key]["source"]);
            return deferred.reject(err);
          }
          sources[key] = src;
          tilelive.load(config[key]["destination"], function(err, dest) {
            if (err) {
              console.log("Error loading destination " + config[key]["destination"]);
              return deferred.reject(err);
            }
            sinks[key] = dest;
            deferred.resolve();
          });
        });
      })();
    });

    Q.all(sourceLoadingPromises).then(
      function() {
        debug("Finished loading sources");
        start();
      },
      function(err) {
        debug("Error loading sources");
        console.log(err);
        process.exit(-1);
      }
    );
    sourceLoadingPromises = null;
  }

  function start() {
    if (opts.stdin) {
      var pipe = process.stdin.pipe(require("split")());
      var ended = false;
      var requestCount = 0;
      var finishedCount = 0;
      pipe.on("data", function processLine(line) {
        if (line.length) {
          requestCount++;
          processRequestMessage(
            line,
            function() {
              debug("Request finished " + line);
              finishedCount++;
              if (ended && finishedCount == requestCount) {
                process.exit(0);
              }
            },
            function(err) {
              console.log("Error processing request: " + err);
            }
          );
        }
      });
      pipe.on("end", function() {
        ended = true;
        if (requestCount == 0) {
          debug("Finished reading STDIN with data read, exiting.");
          process.exit(0);
        } else {
          debug("Finished reading STDIN, waiting for tile ");
        }
      });
    } else {
      listen();
    }
  }

  function listen() {
    var ampqHost = process.env.AMPQ_HOST || "localhost";
    var server = "amqp://" + ampqHost;
    var ampqTopic = process.env.AMPQ_TOPIC || "tiles";

    debug("Starting queue listener for " + server + "/" + ampqTopic);

    var queueContext = rabbit.createContext(server);
    queueContext.on("ready", function() {
      debug("Connected to context");
      var sub = queueContext.socket("WORKER", { prefetch: 2 });
      sub.connect(ampqTopic, function() {
        debug("Connected to socket for " + ampqTopic);
        sub.on("data", function(note) {
          var subThis = this; //keep a ref to this around for use in later scopes
          debug("Received request " + note.toString());
          processRequestMessage(
            note.toString(),
            function() {
              subThis.ack();
            },
            function(err) {
              subThis.requeue();
            }
          );
        });
      });
    });
  }

  function processRequestMessage(request, success, errorC) {
    var messageComponents = request.split("+");
    var sourceName = messageComponents[0];
    var tileComponents = messageComponents[1].split("/");

    var source = sources[sourceName];
    var dest = sinks[sourceName];
    if (source == null) {
      if (opts.defer) {
        tilelive.load(config[sourceName]["source"], function(err, source) {
          if (err) {
            console.log("Error loading source " + config[sourceName]["source"]);
            return success(err);
          }
          sources[sourceName] = source;
          tilelive.load(config[sourceName]["destination"], function(err, dest) {
            if (err) {
              console.log("Error loading destination " + config[sourceName]["destination"]);
              return errorC(err);
            }
            sinks[sourceName] = dest;
            processRequest(tileComponents, source, dest, sourceName, success, errorC);
          });
        });
      } else {
        //source not found, send it back to the queue
        console.log("Error: source " + sourceName + " not found");
        return errorC(null);
      }
    } else {
      processRequest(tileComponents, source, dest, sourceName, success, errorC);
    }
  }

  function processRequest(tileComponents, source, dest, sourceName, success, errorC) {
    var z = parseInt(tileComponents[0]);
    var startX, endX, startY, endY;
    var xComponents = tileComponents[1].split("-");
    if (xComponents.length == 1) {
      startX = endX = parseInt(xComponents[0]);
    } else {
      startX = parseInt(xComponents[0]);
      endX = parseInt(xComponents[1]);
    }

    var yComponents = tileComponents[2].split("-");
    if (yComponents.length == 1) {
      startY = endY = parseInt(yComponents[0]);
    } else {
      startY = parseInt(yComponents[0]);
      endY = parseInt(yComponents[1]);
    }

    debug("opening source " + dest + " for writing");
    dest.startWriting(function(err) {
      if (err) {
        console.log(err);
        throw err;
      }
      var tilePromises = [];

      for (var x = startX; x <= endX; x++) {
        for (var y = startY; y <= endY; y++) {
          (function() {
            var tileX = x,
              tileY = y,
              tileZ = z,
              deferred = Q.defer();

            source.getTile(tileZ, tileX, tileY, function(err, tile, options) {
              if (err) {
                console.log(err);
              } else {
                debug("Rendered tile " + sourceName + "+" + tileZ + "/" + tileX + "/" + tileY);
                dest.putTile(tileZ, tileX, tileY, tile, function(err) {
                  if (err) {
                    console.log(err);
                    deferred.reject(err);
                  } else {
                    deferred.resolve();
                  }
                });
              }
            });
            tilePromises.push(deferred.promise);
          })();
        }
      }

      debug("Waiting for " + tilePromises.length + " tiles to render for " + request);
      Q.all(tilePromises).then(
        function() {
          debug("All tile promises resolved, closing source for writing for " + request);
          dest.stopWriting(function(err) {
            if (err) {
              console.log(err);
              errorC(err);
            } else {
              success();
            }
          });
        },
        function(err) {
          console.log("error resolving tile promises", err);
          errorC(err);
        }
      );
    });
  }
};
