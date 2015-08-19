#!/usr/bin/env node

"use strict";
var debug = debug = require("debug")("tile-squirrel-add-bbox"),
  SphericalMercator = require("SphericalMercator"),
  QueueWriter =  require("../lib/queueWriter");

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
      help: "Provide a configuration file"
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
      help: "Max x size",
      default: 8
    },
    ySize: {
      metavar: "size",
      help: "Max y size",
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
  .help("A zoom, or range of zooms is required.");

var opts = nomnom.parse();

if(!opts.zoom) {
  console.log("Zoom paramater is required.")
  process.exit(-1);
}

if(!opts.sources || opts.sources.length == 0) {
  console.log("At least 1 source name is required.");
  process.exit(-1);
}

var minZoom = 0,
  maxZoom = 0;

console.log(typeof opts.zoom);
if((typeof opts.zoom) === "number") {
  minZoom = maxZoom = opts.zoom;
} else if(opts.zoom.toString().search("-") == -1) {
  minZoom = maxZoom = parseInt(opts.zoom.toString());
} else {
  var zoomComponents = opts.zoom.toString().split("-");
  if(zoomComponents.length != 2) {
    console.log("Error: zoom range must be 2 numbers seperated by a -");
    process.exit(-1);
  }

  minZoom = parseInt(zoomComponents[0]);
  maxZoom = parseInt(zoomComponents[1]);
}

var bbox = opts.bbox.split(",");
if(bbox.length != 4) {
  console.log("BBOX must have 4 numbers seperated by ,");
  process.exit(-1);
}

for(var i = 0; i < bbox.length; i++) {
  bbox[i] = parseFloat(bbox[i]);
}

var merc = new SphericalMercator({
    size: 256
});

function iterateTiles(queueWriter) {
  for(var zoom = minZoom; zoom <= maxZoom; zoom++) {
    var tileBounds = merc.xyz(bbox, zoom);
    debug(zoom, tileBounds);
    var zoomString = zoom.toString();
    for(var x = tileBounds.minX; x <= tileBounds.maxX; x += opts.xSize) {
      var maxX = Math.min(x + opts.xSize - 1, tileBounds.maxX);
      var xRangeString;
      if(x == maxX) {
        xRangeString = x.toString();
      } else {
        xRangeString = x.toString() + "-" + maxX.toString();
      }
      for(var y = tileBounds.minY; y <= tileBounds.maxY; y += opts.ySize) {
        var maxY = Math.min(y + opts.ySize - 1, tileBounds.maxY);
        var yRangeString;
        if(y == maxY) {
          yRangeString = y.toString();
        } else {
          yRangeString = y.toString() + "-" + maxY.toString();
        }
        var tileRangeName = zoomString + "/" + xRangeString + "/" +  yRangeString;
        debug(tileRangeName);
        queueWriter.putTile(tileRangeName);
      }
    }
  }
  queueWriter.tileStream.end();
};

new QueueWriter(opts.sources, {}, function(err, queueWriter) {
  iterateTiles(queueWriter);
});
