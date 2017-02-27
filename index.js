var assert = require('assert')
var fs = require('fs')
var path = require('path')
var agsWalk = require('ags-walk')
var esriDump = require('esri-dump')
var ndjson = require('ndjson')
var pump = require('pump')
var request = require('request')
var mkdirp = require('mkdirp')
var collectJson = require('collect-json')
var through = require('through2')

module.exports = ExportArcGIS

function ExportArcGIS (url, opts) {
  assert.same(typeof url, 'string', 'url required for export')
  opts = opts || {}

  this.server = url
  this.options = opts
  this.dir = opts.dir || path.join(process.cwd(), 'data')
  this.services = []
}

ExportArcGIS.prototype._getServices = function (cb) {
  var self = this
  agsWalk(self.server, function (err, services) {
    if (err) return cb(err)
    self.services = services
    cb(null, services)
  })
}

ExportArcGIS.prototype.getAllMetadata = function (opts, cb) {
  var self = this
  if (!self.services) return self._getServices(function (err) {
    if (err) return cb(err)
    self.getAllMetadata(opts, cb)
  })

  self.services.map(function (service) {
    console.log(service)
    if (service.name === 'PotholeHotline') {
      getMetadata(service, function (err, layers) {
        if (err) return cb(err)
        // if (layers) console.log(layers) // pendingLayers = pendingLayers.concat(layers)
        if (layers) getLayerData(layers[0])
      })
    }
  })
}

ExportArcGIS.prototype.getMetadata = function (service, cb) {
  assert.ok(service, 'service required')
  var self = this
  var layers
  var url = service.url
  var dir = path.join(self.dir, service.name)

  mkdirp.sync(dir)
  var ws = fs.createWriteStream(path.join(dir, 'metadata.json'))
  var r = request.get({url: url, qs: {f: 'pjson'}})

  pump(r, collectJson(function (json) {
    layers = json.layers
    return JSON.stringify(json)
  }), ws, function (err) {
    if (err) return cb(err)
    // console.log(`${service.name}: metadata downloaded`)
    // console.log(`${service.name}: ${layers.length} layers`)
    getLayersMetadata()
  })

  function getLayersMetadata () {
    var pending = layers.length
    var layerUrls = []
    layers.map(function (layer) {
      var layerDir = path.join(dir, layer.id.toString())
      var url = service.url + '/' + layer.id
      layerUrls.push({url: url, dir: layerDir})
      mkdirp.sync(layerDir)

      var ws = fs.createWriteStream(path.join(layerDir, 'metadata.json'))
      pump(request.get(url, {qs: {f: 'pjson'}}), ws, function (err) {
        if (err) return cb(err)
        if (!--pending) cb(null, layerUrls)
      })
    })
  }
}

ExportArcGIS.prototype.getLayerData = function (layer) {
  var url = layer.url
  var jsonStream = esriDump(url)
  var featureCollection = {
    type: 'FeatureCollection',
    features: []
  }
  var serialize = ndjson.serialize()
  var ws = fs.createWriteStream(path.join(layer.dir, 'data.json'))
  var count = 0

  console.log('getting', url)
  jsonStream.on('type', function (type) {
    console.log('type', type)
  })

  pump(jsonStream, serialize, through(function (chunk, enc, next) {
    count++
    next(null, chunk)
  }), ws, function (err) {
    if (err) return console.error(err)
    console.log('done got', count)
  })
}
