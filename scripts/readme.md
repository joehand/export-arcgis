# metadata exporters

## `services.js`

Walk ArcGIS REST API servers and get all folders & services on that endpoint.

### Usage

```
echo '{ "url": "https://www.portlandmaps.com/arcgis/rest/services/", "name": "portland-maps"}' | node scripts/services.js > services.json
```

## `layers.js`

Walk ArcGIS services (created with `services.js`) and get all layers for every service.

### Usage

```
cat services.json | node scripts/layers.js > layers.json
```

## `data.js`

Download all data from every layer in a json file.

This requires `esri2geojson`, via [esri-dump](https://github.com/openaddresses/esri-dump) python module, to be available in the current path.

There is also a js version of `esri-dump` but it is less maintained and more buggy =(.

### Usage

```
cat layers.json | node scripts/data.js data-dir > downloads.json
```
