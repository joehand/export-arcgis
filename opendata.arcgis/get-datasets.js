var paginationStream = require('pagination-stream')
var JSONStream = require('JSONstream')
var ndjson = require('ndjson')
var pump = require('pump')
var fs = require('fs')
var path = require('path')

var reqHeaders = {"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36"}
var options = {
  urlFormat: 'http://opendata.arcgis.com/datasets.json?page=%d&per_page=100',
  headers: reqHeaders,
  start: 0,
  end: 599,
  retries: 2
}

var ws = fs.createWriteStream(path.join(process.cwd(), 'opendata.arcgis', 'datasets.json'))
pump(paginationStream(options), JSONStream.parse('data.*'), ndjson.serialize(), ws, function (err) {
  if (err) throw err
})
