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
