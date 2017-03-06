var fs = require('fs')
var url = require('url')
var agsWalk = require('ags-walk')
var ndjson = require('ndjson')
var through = require('through2')
var transform = require('parallel-transform')
var request = require('request')

var PARALLEL = 100

process.stdin
  .pipe(ndjson.parse())
  .pipe(through.obj(function (obj, enc, next) {
    var self = this
    walkServer(obj, function (err, services) {
      if (err) throw err
      services.forEach(function (service) {
        self.push(service)
      })
      next()
    })
  }))
  .pipe(transform(PARALLEL, getMetadata))
  .pipe(ndjson.serialize())
  .pipe(process.stdout)

function getMetadata (service, cb) {
  var url = service.url
  request({url: url, qs: {f: 'pjson'}}, function (err, res, body) {
    if (err) return cb(err)
    if (res.statusCode !== 200) return cb() // TODO
    var data = JSON.parse(body)
    data.date = new Date()
    data.url = url
    data.name = service.name
    data.server = service.parent
    cb(null, data)
  })
}

function walkServer (opts, cb) {
  if (typeof opts === 'string') opts = { url: opts }
  if (!opts.name) {
    var pUrl = url.parse(opts.url.toLowerCase().replace('/arcgis/rest/services',''))
    opts.name = `${pUrl.host.replace(/\./g, '-')}${pUrl.pathname.replace(/\//g, '-')}`
  }
  agsWalk(opts.url, function (err, services) {
    if (err) return cb(err)
    console.error(`${opts.name}: Found ${services.length} services`)

    services.map(function (service) {
      service.parent = {name: opts.name, url: opts.url}
      // TODO: why aren't URLs in here already for some servers? API change?
      if (!service.url) service.url = url.resolve(opts.url, service.name + '/' + service.type)
    })

    cb(null, services)
  })
}
