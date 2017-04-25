var fs = require('fs')
var url = require('url')
var ndjson = require('ndjson')
var through = require('through2')
var transform = require('parallel-transform')
var request = require('request')
var pump = require('pump')
var crypto = require('crypto')
var blobStore = require('content-addressable-blob-store')

var PARALLEL = 2048
var RETRIES = 10
var agentOptions = {
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 10,
  timeout: 60000,
  keepAliveMsecs: 30000,
  // rejectUnauthorized: false // lots of gov sites have bad self signed certs
}
var reqHeaders = {"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36"}


var dataDir = process.argv[2]
var excludeFile = process.argv[3]
if (!dataDir) throw new Error('must specify data directory')
var blobs = blobStore(dataDir)


if (excludeFile) {
  var buffer = through()
  var excludes = {}
  var excludeCount = 0
  process.stdin
    .pipe(buffer)

  fs.createReadStream(excludeFile)
    .pipe(ndjson.parse())
    .pipe(through.obj(function (obj, enc, next) {
      if (!obj.file) return next()
      blobs.exists({key: obj.file}, function (err, exists) {
        if (err || !exists) return next()
        var hash = crypto.createHash('sha256').update(obj.url).digest('hex')
        if (!excludes[hash]) {
          excludes[hash] = true
          excludeCount++
        }
        next()
      })
    }, function end () {
      console.error(JSON.stringify({excludeCount: excludeCount}))
      buffer
        .pipe(ndjson.parse())
        .pipe(through.obj(function (obj, enc, next) {
          var self = this
          if (!obj.distribution || !obj.distribution.length) return next()
          obj.distribution.forEach(function (src) {
            if (!src.downloadURL || src.downloadURL.indexOf('geojson') === -1) return
            var url = src.downloadURL
            var hash = crypto.createHash('sha256').update(url).digest('hex')
            if (excludes[hash]) {
              console.error(JSON.stringify({skipping: url}))
              return
            }
            self.push({url: url , id: obj.identifier})
          })
          next()
        }))
        .pipe(transform(PARALLEL, getResponse))
        .pipe(ndjson.serialize())
        .pipe(process.stdout)
    }))
} else {
  process.stdin
    .pipe(ndjson.parse())
    .pipe(through.obj(function (obj, enc, next) {
      var self = this
      if (!obj.distribution || !obj.distribution.length) return next()
      obj.distribution.forEach(function (src) {
        if (!src.downloadURL || src.downloadURL.indexOf('geojson') === -1) return
        self.push({url: src.downloadURL, id: obj.identifier})
      })
      next()
    }))
    .pipe(transform(PARALLEL, getResponse))
    .pipe(ndjson.serialize())
    .pipe(process.stdout)
}

function getResponse (item, cb) {
  var tries = 0
  tryDownload()
  var retryTime = 0

  function tryDownload (err) {
    if (tries >= RETRIES) {
      var msg = 'Max retries exceeded'
      if (err) msg += ': ' + err.message
      return error(new Error(msg))
    }
    tries++
    var stats = {url: item.url, try: tries}
    if (err) stats.error = err
    console.error(JSON.stringify(stats))
    var start = Date.now()
    setTimeout(function () {
      retryTime = 5000 // after first try
      try {
        var r = request({url: item.url, agentOptions: agentOptions, headers: reqHeaders, time: true})
      } catch (e) {
        e.errType = 'requestInitError'
        return error(e)
      }
      r.on('error', function (err) {
        err.errType = 'reqStreamErr'
        tryDownload(err)
      })
      r.on('response', function (re) {
        var elapsed = Date.now() - start
        var meta = {url: item.url, date: new Date(), headersTook: elapsed, status: re.statusCode, rawHeaders: re.rawHeaders, headers: re.headers}
        meta.id = item.id // uses arcgis identier (url opendata.arcgis.com...)
        var ws = blobs.createWriteStream()
        pump(re, ws, function (err) {
          if (err) {
            err.errType = 'streamPumpErr'
            return tryDownload(err)
          }
          meta.downloadTook = re.timingPhases.total
          meta.file = ws.key
          cb(null, meta)
        })
      })
    }, retryTime)

    function error (err) {
      var obj = {url: item.url, date: new Date(), id: item.id, error: err}
      if (err.code === 'ETIMEDOUT') {
        obj.timeout = true
      }
      cb(null, obj)
    }
  }
}
