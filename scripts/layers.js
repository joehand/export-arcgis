var fs = require('fs')
var url = require('url')
var ndjson = require('ndjson')
var through = require('through2')
var transform = require('parallel-transform')
var request = require('request')

var PARALLEL = 100

/**
 * Get all layers for an ArcGIS REST service endpoint
 * Input: ndjson services (from services.js)
 */

process.stdin
  .pipe(ndjson.parse())
  .pipe(through.obj(function (obj, enc, next) {
    var self = this
    if (!obj.layers || !obj.layers.length) return next()
    // Run for each layer in service
    obj.layers.forEach(function (layer) {
      self.push({layer: layer, service: obj})
    })
    next()
  }))
  .pipe(transform(PARALLEL, getLayer))
  .pipe(ndjson.serialize())
  .pipe(process.stdout)

/*
 * Get data for a given layer
 * item.layer - layer information from service API
 * item.serivce - service information from API
 */
function getLayer (item, cb) {
  var layer = item.layer
  var service = item.service
  var url = service.url + '/' + layer.id
  request(url, {qs: {f: 'json'}}, function (err, res, body) {
    if (err) return cb(err)
    if (res.statusCode !== 200) return cb() // TODO
    var data = JSON.parse(body)
    data.url = url
    data.parentService = service // TODO: don't duplicate all service data
    data.date = new Date()
    cb(null, data)
  })
}