# Export ArcGIS Server Tools

Various WIP tools used for exporting and collecting data on ArcGIS servers.

**Not much to see yet.**

#### Why?

Lots of cities and other government entities use ArcGIS tools. There are easy open data publishing tools that allow them to publish the data directly to an ArcGIS server. It'd be nice to be able to access and search across all of those ArcGIS servers!

#### What? 

Check out [Portland's ArcGIS portal](https://www.portlandmaps.com/arcgis/rest/services/Public).

## Tools

These are WIP.

* Data Exporter - `index.js` - barebone tools to export all metadata and layer data from a given 
* opendata.arcgis.com metadata gathering - `get-datasets.js` - get all the metadata information on [opendata.arcgis.com].

## opendata.arcgis.com

ESRI's open data site. It aggregates datasets from various open GIS servers. 

### API

The API was accessed at [https://opendata.arcgis.com/datasets.json]

### Data

License types:

```
❯ cat opendata.arcgis/datasets.json | jsonfilter structured_license.type | sort | uniq -c
  51 "CC-BY-2.0"
   2 "CC-BY-2.5"
 963 "CC-BY-3.0"
4275 "CC-BY-4.0"
 334 "CC-BY-SA-2.0"
  13 "CC-BY-SA-3.0"
 246 "CC-BY-SA-4.0"
 267 "CC0-1.0"
 237 "ODbL-1.0"
 196 "PDDL-1.0"
25833 "custom"
26977 "none"
```

Get all REST API urls from datasets on opendata.arcgis.com

```
❯ cat opendata.arcgis/datasets.json | jsonmap '`${this.url.toLowerCase().split("rest/services")[0]}`' |sort|uniq -c  
```

Find out what datasets are on `.gov` servers:

```
❯ cat opendata.arcgis/datasets.json | jsonmap 'if (this.url.indexOf(".gov") > 0) { return `${this.url.toLowerCase().split("rest/services")[0]}` } else { return "non-gov" }' |sort|uniq -c  
```