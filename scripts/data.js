var fs = require('fs')
var path = require('path')
var url = require('url')
var ndjson = require('ndjson')
var through = require('through2')
var transform = require('parallel-transform')
var request = require('request')
var mkdirp = require('mkdirp')
var pump = require('pump')
var spawn = require('child_process').spawn

var PARALLEL = 100

if (!process.argv[2]) throw new Error('Directory required')
var dir = path.join(process.argv[2])

mkdirp.sync(dir)

process.on('uncaughtException', function(err) {
  console.error("uncaughtException")
  console.error(err.stack)
  process.exit()
})

/*
 * Input layers ndjson from layers.js
 * Get all data for each layer
 */
process.stdin
  .pipe(ndjson.parse())
  .pipe(transform(PARALLEL, getData))
   // TODO: check for last edit date
  .pipe(ndjson.serialize())
  .pipe(process.stdout)

function getData (layer, cb) {
  var url = layer.url
  var dataDir = path.join(dir, layer.parentService.server.name, layer.parentService.name, layer.id.toString())
  var file = path.join(dataDir, 'data.geojson') // TODO: content-adressable?
  var id = `${layer.parentService.server.name}-${layer.parentService.name}-${layer.id}`
  mkdirp.sync(dataDir)

  var start = Date.now()
  var child = spawn('esri2geojson',[url, '-', '--jsonlines'])
  var ws = fs.createWriteStream(file)
  pump(child.stdout, ws, function (err) {
    if (err) return error(err)

    var elapsed = Date.now() - start
    var meta = {url: url, date: new Date(), downloadTook: elapsed, file: file}

    cb(null, meta)
  })
  child.stderr.pipe(process.stderr) // TODO: -> error

  function error (err) {
    var obj = {url: url, date: new Date(), id: id, error: err}
    cb(null, obj)
  }
}
