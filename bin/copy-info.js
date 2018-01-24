#!/usr/bin/env node

"use strict";
var debug = (debug = require("debug")("tile-squirrel-add-bbox")),
  path = require("path"),
  Q = require("q");

var nomnom = require("nomnom")
  .options({
    sources: {
      position: 0,
      help: "source names to queue",
      list: true
    },
    config: {
      abbr: "c",
      metavar: "CONFIG",
      help: "Configuration file."
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
  .help("Copy metadata from a source to a sink.");

var opts = nomnom.parse();

if (!opts.sources || opts.sources.length == 0) {
  console.log("At least 1 source name is required.");
  process.exit(-1);
}

if (!opts.config) {
  console.log("Config option is required.");
  process.exit(-1);
}

var config = require(path.resolve(opts.config));

//Load and register tilelive modules
var tilelive = require("tilelive");
require("tilelive-modules/loader")(tilelive, opts);

var sourceLoadingPromises = [];
for (var i = 0; i < opts.sources.length; i++) {
  var sourceKey = opts.sources[i];

  var deferred = Q.defer();
  sourceLoadingPromises.push(deferred.promise);
  tilelive.load(config[sourceKey]["source"], function(err, src) {
    if (err) {
      console.log("Error loading source " + config[sourceKey]["source"]);
      return deferred.reject(err);
    }
    tilelive.load(config[sourceKey]["destination"], function(err, dest) {
      if (err) {
        console.log("Error loading destination " + config[sourceKey]["destination"]);
        return deferred.reject(err);
      }
      src.getInfo(function(err, data) {
        if (err) {
          return deferred.reject(err);
        }
        if (data) {
          dest.startWriting(function(err) {
            if (err) {
              return deferred.reject(err);
            }
            dest.putInfo(data, function(err) {
              if (err) {
                return deferred.reject(err);
              }
              dest.stopWriting(function(err) {
                if (err) {
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
}

Q.all(sourceLoadingPromises).then(
  function() {
    process.exit(0);
  },
  function(err) {
    debug("Error loading sources");
    console.log(err);
    process.exit(-1);
  }
);
