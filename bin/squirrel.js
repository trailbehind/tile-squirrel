#!/usr/bin/env node

"use strict";

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
  .help("A tilelive URI or configuration file is required.");

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

case !opts.uri && !opts.config:
  return nomnom.print(nomnom.getUsage());

default:
  return require("../lib/cacher")(opts);
}
