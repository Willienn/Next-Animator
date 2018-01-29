var path = require('path')
var async = require('async')
var lodash = require('lodash')
var log = require('./helpers/log')
var uploadFileStream = require('./helpers/uploadFileStream')
var nowVersion = require('./helpers/nowVersion')
var allPackages = require('./helpers/packages')()
var groups = lodash.keyBy(allPackages, 'name')

var CORE_PATH = groups['@haiku/core'].abspath

// Note: These are hosted via the haiku-internal AWS account
// https://code.haiku.ai/scripts/core/HaikuCore.${vers}.js
// https://code.haiku.ai/scripts/core/HaikuCore.${vers}.min.js
//
// I was asking myself if we wanted to include a string like `staging` in these paths to differentiate
// builds we do from staging from prod, but my current thought is that that isn't necessary since
// the version we push will always be _ahead_ of the version userland is on, and someone would have
// to manually change the snippet to get an advance/untested version

log.log(`uploading cdn core ${nowVersion()}`)

// Note that the S3 object keys should NOT begin with a slash, or the S3 path will get weird

async.series([
  // "Core" - the current hotness
  function (cb) {
    log.log('uploading core dom bundle to code.haiku.ai')
    return uploadFileStream(path.join(CORE_PATH, 'dist', 'dom.bundle.js'), `scripts/core/HaikuCore.${nowVersion()}.js`, 'us-east-1', 'code.haiku.ai', 'production', 'code.haiku.ai', 'public-read', cb)
  },

  function (cb) {
    log.log('uploading core dom bundle to code.haiku.ai (as "latest")')
    return uploadFileStream(path.join(CORE_PATH, 'dist', 'dom.bundle.js'), `scripts/core/HaikuCore.latest.js`, 'us-east-1', 'code.haiku.ai', 'production', 'code.haiku.ai', 'public-read', cb)
  },

  function (cb) {
    log.log('uploading core dom bundle to code.haiku.ai (minified)')
    return uploadFileStream(path.join(CORE_PATH, 'dist', 'dom.bundle.min.js'), `scripts/core/HaikuCore.${nowVersion()}.min.js`, 'us-east-1', 'code.haiku.ai', 'production', 'code.haiku.ai', 'public-read', cb)
  },

  function (cb) {
    log.log('uploading core dom bundle to code.haiku.ai (minified, as "latest")')
    return uploadFileStream(path.join(CORE_PATH, 'dist', 'dom.bundle.min.js'), `scripts/core/HaikuCore.latest.min.js`, 'us-east-1', 'code.haiku.ai', 'production', 'code.haiku.ai', 'public-read', cb)
  },

  // "Player" - the legacy name
  function (cb) {
    log.log('uploading player dom bundle to code.haiku.ai')
    return uploadFileStream(path.join(CORE_PATH, 'dist', 'dom.bundle.js'), `scripts/player/HaikuPlayer.${nowVersion()}.js`, 'us-east-1', 'code.haiku.ai', 'production', 'code.haiku.ai', 'public-read', cb)
  },

  function (cb) {
    log.log('uploading player dom bundle to code.haiku.ai (as "latest")')
    return uploadFileStream(path.join(CORE_PATH, 'dist', 'dom.bundle.js'), `scripts/player/HaikuPlayer.latest.js`, 'us-east-1', 'code.haiku.ai', 'production', 'code.haiku.ai', 'public-read', cb)
  },

  function (cb) {
    log.log('uploading player dom bundle to code.haiku.ai (minified)')
    return uploadFileStream(path.join(CORE_PATH, 'dist', 'dom.bundle.min.js'), `scripts/player/HaikuPlayer.${nowVersion()}.min.js`, 'us-east-1', 'code.haiku.ai', 'production', 'code.haiku.ai', 'public-read', cb)
  },

  function (cb) {
    log.log('uploading player dom bundle to code.haiku.ai (minified, as "latest")')
    return uploadFileStream(path.join(CORE_PATH, 'dist', 'dom.bundle.min.js'), `scripts/player/HaikuPlayer.latest.min.js`, 'us-east-1', 'code.haiku.ai', 'production', 'code.haiku.ai', 'public-read', cb)
  },

  function (cb) {
    log.hat(`      our provided 3rd-party scripts:
      https://code.haiku.ai/scripts/core/HaikuCore.${nowVersion()}.js
      https://code.haiku.ai/scripts/core/HaikuCore.${nowVersion()}.min.js
      https://code.haiku.ai/scripts/player/HaikuPlayer.${nowVersion()}.js
      https://code.haiku.ai/scripts/player/HaikuPlayer.${nowVersion()}.min.js

      and for convenience:
      https://code.haiku.ai/scripts/core/HaikuCore.latest.js
      https://code.haiku.ai/scripts/core/HaikuCore.latest.min.js
      https://code.haiku.ai/scripts/player/HaikuPlayer.latest.js
      https://code.haiku.ai/scripts/player/HaikuPlayer.latest.min.js

      ^^ you probably need to invalidate cloudfront for the "latest" files to update ^^`)

    return cb()
  }
], (err) => {
  if (err) throw err
  log.log('done uploading cdn core')
})