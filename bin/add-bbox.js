#!/usr/bin/env node

"use strict";
var async = require("async"),
  debug = require("debug")("tile-squirrel-add-bbox"),
  path = require("path"),
  SphericalMercator = require("sphericalmercator"),
  QueueWriter = require("../lib/queueWriter");

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
      help:
        "Provide a configuration file. Configuration file is not needed," +
        " but if it is provided sources will be verified to exist in config."
    },
    dryRun: {
      abbr: "d",
      flag: true,
      help: "Dry run. Don't actually add messages to queue."
    },
    zoom: {
      abbr: "z",
      metavar: "ZOOM",
      help: "zoom, can be a single number or a range like 5-10",
      list: true
    },
    bbox: {
      abbr: "b",
      metavar: "BBOX",
      help: "BBOX in W,S,E,N format",
      default: "-180,-85.0511287798066,180,85.0511287798066"
    },
    xSize: {
      metavar: "size",
      help: "Max x size of chunks.",
      default: 8
    },
    ySize: {
      metavar: "size",
      help: "Max y size of chunks.",
      default: 8
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
  .help("A zoom, or range of zooms, and one or more sources is required.");

var opts = nomnom.parse();

if (!opts.zoom) {
  console.log("Zoom paramater is required.");
  process.exit(-1);
}

if (!opts.sources || opts.sources.length == 0) {
  console.log("At least 1 source name is required.");
  process.exit(-1);
}

//Check if source exists if a config was specified
if (opts.config) {
  var config = require(path.resolve(opts.config));
  for (var i = 0; i < opts.sources.length; i++) {
    if (!config[opts.sources[i]]) {
      console.log("Source " + opts.sources[i] + " not found in config");
      process.exit(-1);
    }
  }
}

var minZoom = 0,
  maxZoom = 0;

if (typeof opts.zoom === "number") {
  minZoom = maxZoom = opts.zoom;
} else if (opts.zoom.toString().search("-") == -1) {
  minZoom = maxZoom = parseInt(opts.zoom.toString());
} else {
  var zoomComponents = opts.zoom.toString().split("-");
  if (zoomComponents.length != 2) {
    console.log("Error: zoom range must be 2 numbers seperated by a -");
    process.exit(-1);
  }

  minZoom = parseInt(zoomComponents[0]);
  maxZoom = parseInt(zoomComponents[1]);
}

debug("Zoom range: " + minZoom + "-" + maxZoom);

var bbox = opts.bbox.split(",");
if (bbox.length != 4) {
  console.log("BBOX must have 4 numbers seperated by ,");
  process.exit(-1);
}

for (var i = 0; i < bbox.length; i++) {
  bbox[i] = parseFloat(bbox[i]);
}

var merc = new SphericalMercator({
  size: 256
});

function iterateTiles(queueWriter) {
  var zooms = [];
  for (var zoom = minZoom; zoom <= maxZoom; zoom++) {
    zooms.push(zoom);
  }
  async.eachSeries(
    zooms,
    function(zoom, zoomCallback) {
      var tileBounds = merc.xyz(bbox, zoom);
      debug(zoom, tileBounds);
      var zoomString = zoom.toString();
      var xValues = [];
      for (var x = tileBounds.minX; x <= tileBounds.maxX; x += opts.xSize) {
        xValues.push(x);
      }
      async.eachSeries(
        xValues,
        function(x, xCallback) {
          var maxX = Math.min(x + opts.xSize - 1, tileBounds.maxX);
          var xRangeString;
          if (x == maxX) {
            xRangeString = x.toString();
          } else {
            xRangeString = x.toString() + "-" + maxX.toString();
          }
          var yValues = [];
          for (var y = tileBounds.minY; y <= tileBounds.maxY; y += opts.ySize) {
            yValues.push(y);
          }
          async.eachSeries(
            yValues,
            function(y, yCallback) {
              var maxY = Math.min(y + opts.ySize - 1, tileBounds.maxY);
              var yRangeString;
              if (y == maxY) {
                yRangeString = y.toString();
              } else {
                yRangeString = y.toString() + "-" + maxY.toString();
              }
              var tileRangeName =
                zoomString + "/" + xRangeString + "/" + yRangeString;
              debug(tileRangeName);
              queueWriter.putTile(tileRangeName, yCallback);
            },
            function(err) {
              xCallback(err);
            }
          );
        },
        function(err) {
          debug("finished with zoom: " + zoom);
          zoomCallback(err);
        }
      );
    },
    function(err) {
      if (err) {
        console.log(err);
      }
      debug("calling tileStream.end");
      queueWriter.tileStream.end();
    }
  );
}

new QueueWriter(opts.sources, { dryRun: opts.dryRun }, function(
  err,
  queueWriter
) {
  iterateTiles(queueWriter);
});
