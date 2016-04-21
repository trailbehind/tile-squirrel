#!/usr/bin/env node

"use strict";

process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || 4;

var nomnom = require("nomnom")
  .options({
    config: {
      abbr: "c",
      metavar: "CONFIG",
      help: "Provide a configuration file"
    },
    require: {
      abbr: "r",
      metavar: "MODULE",
      help: "Require a specific tilelive module",
      list: true
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
  .help("A configuration file is required.");

var argv = (process.env.TILESQUIRREL_OPTS || "")
  .split(" ")
  .concat(process.argv.slice(2))
  .filter(function(x) {
    return !!x;
  });

var opts = nomnom.parse(argv);

switch (true) {
case opts.version:
  return process.exit();

case !opts.config:
  return nomnom.print(nomnom.getUsage());

default:
  return run(opts);
}

function run(opts) {
  var cluster = require('cluster'),
    numCPUs = require('os').cpus().length;

  var numworkers = process.env.WORKER_COUNT || numCPUs; 
  if (cluster.isMaster) {
    // Fork workers.
    for (var i = 0; i < numworkers; i++) {
      cluster.fork();
    }
  
    cluster.on('exit', (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`);
    });
  } else {
    console.log("Starting worker");
    require("../lib/cacher")(opts);
  }
}
