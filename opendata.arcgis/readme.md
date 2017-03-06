# opendata.arcgis.com

ESRI's open data site. It aggregates datasets from various open GIS servers. 

### API

The API was accessed at [](https://opendata.arcgis.com/datasets.json)

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