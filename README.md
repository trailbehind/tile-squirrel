# Tile Squirrel
Tile Squirrel is designed to render map tiles in bulk across multiple hosts. Tiles are added to a queue, and then one or more workers can read from the queue and render tiles. RabbitMQ is used for queuing, and tilelive is used for sources and destinations for tiles.

## Commands

### squirrel.js
This is the tiling worker. It reads from the queue and makes tiles.

```
Usage: node squirrel.js [options]

Options:
   -c CONFIG, --config CONFIG    Provide a configuration file
   -r MODULE, --require MODULE   Require a specific tilelive module
   -v, --version                 Show version info

A configuration file is required.
```

### add-bbox.js
Add all tiles in a bounding box to the queue. Can work on one or more sources at a time. Tiles are split into groups for queuing. 

```
Usage: node add-bbox.js [sources]... [options]

sources     source names to queue

Options:
   -c CONFIG, --config CONFIG   Provide a configuration file. Configuration file is not needed, but if it is provided sources will be verified to exist in config.
   -z ZOOM, --zoom ZOOM         zoom, can be a single number or a range like 5-10
   -b BBOX, --bbox BBOX         BBOX in W,S,E,N format  [-180,-85.0511287798066,180,85.0511287798066]
   --xSize size                 Max x size of chunks.  [8]
   --ySize size                 Max y size of chunks.  [8]
   -v, --version                Show version info

A zoom, or range of zooms, and one or more sources is required.
```

### add-tile-list.js
Add a list of tiles to the queue. Defaults to reading from STDIN, but can also read from a file.

```
Usage: node add-tile-list.js [sources]... [options]

sources     source names to queue

Options:
   -f FILE, --file FILE   Read list from file. By default list is read from STDIN
   -v, --version          Show version info

Read a list of tiles to queue for rendering.
```

### add-tile.js
Add a single tile to the queue.

```
Usage: node add-tile.js [source] [tile] [options]

source     Source to queue
tile       Tile to queue

Options:
   -c CONFIG, --config CONFIG   Provide a configuration file. Configuration file is not needed, but if it is provided sources will be verified to exist in config.
   -v, --version                Show version info

Queue a single tile
```


## Configuration

### Configuration File
The configuration file defines a tilesets, each with a source and a sink.

```
{
  "topo": {
    "source": "tmsource:///Users/jesse/projects/topo.tm2source",
    "destination": "file:///Users/jesse/working-data/squirrel-tiles?filetype=pbf"
  },
  "osm":{
    "source":"tmsource:///Users/jesse/projects/osm.tm2source",
    "destination":"s3simple://vector-tiles-testing.gaiagps.com/osm/?filetype=pbf"
  }
}
```

The configuration file aims to be compatible with [Tessera](https://github.com/mojodna/tessera).

### Environment variables
* `AMPQ_HOST` - RabbitMQ host to connect to. Defaults to `localhost`.
* `AMPQ_TOPIC` - RabbitMQ topic to use. Defaults to `tiles`.
* `UV_THREADPOOL_SIZE` - Threadpool size to use. defaults to `max(4, cpus * 1.5)`
* `TILESQUIRREL_OPTS` - Additional command line arguments.
