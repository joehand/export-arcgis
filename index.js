var assert = require('assert')
var fs = require('fs')
var path = require('path')
var url = require('url')
var agsWalk = require('ags-walk')
var esriDump = require('esri-dump')
var ndjson = require('ndjson')
var pump = require('pump')
var request = require('request')
var mkdirp = require('mkdirp')
var collectJson = require('collect-json')
var through = require('through2')
var transform = require('parallel-transform')
var debug = require('debug')('export-arcgis')

module.exports = ExportArcGIS

function ExportArcGIS (url, opts) {
  if (!(this instanceof ExportArcGIS)) return new ExportArcGIS(url, opts)
  assert.equal(typeof url, 'string', 'url required for export')
  opts = opts || {}

  this.server = url
  this.options = opts
  this.dir = opts.dir || path.join(process.cwd(), 'data')
  this.services = []

  mkdirp.sync(this.dir)
}

ExportArcGIS.prototype.getServices = function (cb) {
  debug('getServices')
  var self = this
  agsWalk(self.server, function (err, services) {
    if (err) return cb(err)
    debug(`Got ${services.length} services`)
    if (!services[0].url) {
      // add url to service list
      // TODO: why aren't these in here already for some servers? API change?
      services.map(function (service) {
        service.url = url.resolve(self.server, service.name + '/' + service.type)
      })
    }

    self.services = services
    cb(null, services)
  })
}

ExportArcGIS.prototype.getServicesMetadata = function (services, cb) {
  assert.ok(services, 'services required')
  debug('getServiceMetadata')

  var self = this
  var pending = services.length
  var serialize = ndjson.serialize()
  var ws = fs.createWriteStream(path.join(self.dir, 'services.json'))
  pump(serialize, ws)

  services.map(function (service) {
    var url = service.url
    debug('getting metadata', url)
    request({url: url, qs: {f: 'json'}}, function (err, res, body) {
      if (err) return cb(err)
      if (res.statusCode !== 200) return debug('bad request', url) // TODO
      var data = JSON.parse(body)
      data.date = new Date()
      data.url = url
      data.name = service.name
      data.serverUrl = self.url
      serialize.write(data)
      if (!--pending) done()
    })
  })

  function done () {
    serialize.end()
    cb(null)
  }
}

ExportArcGIS.prototype.getLayersMetadata = function (cb) {
  var self = this

  var PARALLEL = 10
  var output = path.join(self.dir, 'layers.json')
  var ws = fs.createWriteStream(output)
  var serialize = ndjson.serialize()
  serialize.pipe(ws)

  fs.createReadStream(path.join(__dirname, 'data', 'services.json'))
    .pipe(ndjson.parse())
    .pipe(through.obj(function (obj, enc, next) {
      getLayersMetadata(obj, function (err) {
        next()
      })
    }))

  function getLayersMetadata (service, cb) {
    debug(`${service.name}: downloading layer metadata`)
    var layers = service.layers
    if (!layers || !layers.length) return done()
    var pending = layers.length
    layers.map(function (layer) {
      var url = service.url + '/' + layer.id
      request(url, {qs: {f: 'json'}}, function (err, res, body) {
        if (err) return cb(err)
        if (res.statusCode !== 200) return debug('bad req') // TODO
        var data = JSON.parse(body)
        data.url = url
        data.parentService = service.name
        data.date = new Date()
        serialize.write(data)
        if (!--pending) done()
      })
    })

    function done () {
      cb(null)
    }
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
  var ws = fs.createWriteStream(path.join(layer.dir, 'data-' + new Date().toISOString().slice(0,10) + '.json'))
  var count = 0

  debug('getting', url)
  jsonStream.on('type', function (type) {
    debug('type', type)
  })

  pump(jsonStream, serialize, through(function (chunk, enc, next) {
    count++
    next(null, chunk)
  }), ws, function (err) {
    if (err) return console.error(err)
    debug('done got', count)
  })
}
