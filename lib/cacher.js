#!/usr/bin/env node
"use strict";

// increase the libuv threadpool size to 1.5x the number of logical CPUs.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || 
  Math.ceil(Math.max(4, require('os').cpus().length * 1.5));

var path = require("path"),
  debug = require("debug"),
  rabbit = require('rabbit.js'),
  Q = require("q");

debug = debug("tile-squirrel-cacher");

module.exports = function(opts) {
  var tilelive = require("tilelive");

  // load and register tilelive modules
  require("tilelive-modules/loader")(tilelive, opts);

  if (opts.uri) {
    throw "For now you must use a config file in queue mode";
  }

  //Load all sources
  var sources = {};
  var sinks = {};

  if (opts.config) {
    var config = require(path.resolve(opts.config));
    debug("Loading " + Object.keys(config).length + " sources");

    var sourceLoadingPromises = [];
    Object.keys(config).forEach(function(prefix) {
      (function(){
        var key = prefix;
        var deferred = Q.defer();
        sourceLoadingPromises.push(deferred.promise);
        tilelive.load(config[prefix]['source'], function(err, src){
          if(err) {
            console.log("Error loading source " + config[prefix]['source']);
            return deferred.reject(err);
          }
          sources[key] = src;
          tilelive.load(config[prefix]['destination'], function(err, dest){
            if(err) {
              console.log("Error loading destination " + config[prefix]['destination']);
              return deferred.reject(err);
            }
            sinks[key] = dest;
            src.getInfo(function(err, data){
              if(err){
                return deferred.reject(err);
              }
              if(data) {
                dest.startWriting(function(err){
                  if(err) {
                    return deferred.reject(err);
                  }
                  dest.putInfo(data, function(err){
                    if(err) {
                      return deferred.reject(err);
                    }
                    dest.stopWriting(function(err){
                      if(err) {
                        deferred.reject(err);
                      } else {
                        deferred.resolve();
                      }
                    });
                  });
                });
              }
            });
          });
        });
      }());
    });
    
    Q.all(sourceLoadingPromises).then(function() {
      debug("Finished loading sources");
      listen();
    }, function(err) {
      debug("Error loading sources");
      console.log(err);
      process.exit(-1);
    });
    sourceLoadingPromises = null;
  }
  
  function listen() {
    var ampqHost = process.env.AMPQ_HOST || "localhost";
    var server = 'amqp://' + ampqHost;
    var ampqTopic = process.env.AMPQ_TOPIC || "tiles";

    debug("Starting queue listener for " + server + "/" + ampqTopic);

    var queueContext = rabbit.createContext(server);
    queueContext.on('ready', function() {
      debug("Connected to context");
      var sub = queueContext.socket('WORKER', {prefetch: 2});
      sub.connect(ampqTopic, function() {
        debug("Connected to socket for " + ampqTopic);
        sub.on('data', function(note) {
          var subThis = this; //keep a ref to this around for use in later scopes
          debug("Received request " + note.toString());
          var messageComponents = note.toString().split("+");
          var sourceName = messageComponents[0];

          var tileComponents = messageComponents[1].split("/");
          var z = parseInt(tileComponents[0]);
          var startX, endX, startY, endY;
          var xComponents = tileComponents[1].split("-");
          if(xComponents.length == 1) {
            startX = endX = parseInt(xComponents[0]);
          } else {
            startX = parseInt(xComponents[0]);
            endX = parseInt(xComponents[1]);
          }

          var yComponents = tileComponents[2].split("-");
          if(yComponents.length == 1) {
            startY = endY = parseInt(yComponents[0]);
          } else {
            startY = parseInt(yComponents[0]);
            endY = parseInt(yComponents[1]);
          }

          var source = sources[sourceName];
          var dest = sinks[sourceName];
          if(source == null) { //source not found, send it back to the queue
            console.log("Error: source " + sourceName + " not found");
            subThis.requeue();
            return;
          }

          debug("opening source " + config[sourceName]['destination'] + " for writing");
          dest.startWriting(function(err) {
            if(err) {
              console.log(err);
              throw err;
            }
            var tilePromises = [];

            for(var x = startX; x <= endX; x++) {
              for(var y = startY; y <= endY; y++) {
                (function(){
                  var tileX = x,
                    tileY = y,
                    tileZ = z,
                    deferred = Q.defer();

                  source.getTile(tileZ, tileX, tileY, function(err, tile, options) {
                    if(err) {
                      console.log(err);
                    } else {
                      debug("Rendered tile " + sourceName + "+" + tileZ + "/" + tileX + "/" + tileY);
                      dest.putTile(tileZ, tileX, tileY, tile, function(err){
                        if(err) {
                          console.log(err);
                          deferred.reject(err);
                        } else {
                          deferred.resolve();
                        }
                      });
                    }
                  });
                  tilePromises.push(deferred.promise);
                }());
              }
            }

            debug("Waiting for " + tilePromises.length + " tiles to render for " + note.toString());
            Q.all(tilePromises).then(function() {
              debug("All tile promises resolved, closing source for writing for " + note.toString());
              dest.stopWriting(function(err) {
                if(err) {
                  console.log(err);
                  subThis.requeue();
                } else {
                  subThis.ack();
                }
              });
            }, function(err) {
              console.log("error resolving tile promises", err);
              subThis.requeue();
            });
          });
        });
      });
    });
  }
};
