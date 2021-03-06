#!/usr/bin/env node

"use strict";

process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || 4;

var nomnom = require("nomnom")
  .options({
    config: {
      abbr: "c",
      metavar: "CONFIG",
      required: true,
      help: "Provide a configuration file"
    },
    require: {
      abbr: "r",
      metavar: "MODULE",
      help: "Require a specific tilelive module",
      list: true
    },
    defer: {
      abbr: "d",
      flag: true,
      help: "Defer loading sources until a message is received"
    },
    version: {
      abbr: "v",
      flag: true,
      help: "Show version info",
      callback: function() {
        return "tile-squirrel v" + require("../package.json").version;
      }
    },
    stdin: {
      abbr: "s",
      flag: true,
      help: "Read messages from stdin instead of RabbitMQ"
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

  case opts.stdin:
    return runStdin(opts);

  default:
    return run(opts);
}

function run(opts) {
  var cluster = require("cluster"),
    numCPUs = require("os").cpus().length;

  var numworkers = process.env.WORKER_COUNT || numCPUs;
  var failureCount = 0;
  if (cluster.isMaster) {
    // Fork workers.
    for (var i = 0; i < numworkers; i++) {
      cluster.fork();
    }

    cluster.on("exit", (oldWorker, code, signal) => {
      failureCount += 1;
      if (failureCount < numworkers * 3) { // Dont restart forever, only allow 3 restarts per worker.
        var worker = cluster.fork();
        console.log(`worker ${oldWorker.process.pid} died and has been replaced by ${worker.process.pid}`);
      } else {
        console.log(`worker ${oldWorker.process.pid} died. Not starting a new worker because of too many failures.`);
      }
    });
  } else {
    console.log("Starting worker");
    require("../lib/cacher")(opts);
  }
}

function runStdin(opts) {
  require("../lib/cacher")(opts);
}
