var fs = require('fs')
var url = require('url')
var path = require('path')
var ndjson = require('ndjson')
var through = require('through2')
var transform = require('parallel-transform')
var request = require('request')
var pump = require('pump')
var esriDump = require('esri-dump')
var mkdirp = require('mkdirp')

var PARALLEL = 1

// cat layers.json | node layerData.js data/ > data/metadata.json

if (!process.argv[2]) throw new Error('Directory required')
var dir = path.join('data', process.argv[2])

mkdirp.sync(dir)

process.on('uncaughtException', function(err) {
    console.error("uncaughtException")
    console.error(err.stack)
    process.exit()
})

process.stdin
  .pipe(ndjson.parse())
  .pipe(transform(PARALLEL, getData))
  // update metadata with data path?
  .pipe(ndjson.serialize())
  .pipe(process.stdout)

function getData (layer, cb) {
  var url = layer.url
  var jsonStream = esriDump(url)
  var serialize = ndjson.serialize()
  console.error(url)
  var dataDir = path.join(dir, layer.name)
  mkdirp.sync(dataDir)
  var ws = fs.createWriteStream(path.join(dataDir, 'data-' + new Date().toISOString().slice(0,10) + '.json'))
  var count = 0
  var featureCollection = {
    type: 'FeatureCollection',
    features: []
  }

  // debug('getting', url)
  // jsonStream.on('type', function (type) {
  //   debug('type', type)
  // })

  pump(jsonStream, serialize, through.obj(function (chunk, enc, next) {
    // console.error(chunk)
    featureCollection.features.push(JSON.parse(chunk))
    count++
    next(null, chunk)
  }), ws, function (err) {
    if (err) {
      console.log('here err')
      console.error(err)
      console.error(err.stack)
    }
    // debug('done got', count)
    fs.writeFile(path.join(dataDir, 'data.geojson'), JSON.stringify(featureCollection), function (err) {
      if (err) console.error(err)
      cb(null, layer)
    })
  })
}