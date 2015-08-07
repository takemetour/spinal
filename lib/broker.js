var rpc = require('pm2-axon-rpc')
  , axon = require('pm2-axon')
  , EventEmitter = require("events").EventEmitter
  , Router = require('./router')
  , _ = require('lodash')
  , puid = new (require('puid'))(false)
  , Redis = require('ioredis')
  , debug = require('debug')('spinal:broker')
  , Stringify = require('../node_modules/pm2-axon-rpc/node_modules/json-stringify-safe')
  , Message = require('../node_modules/pm2-axon/node_modules/amp-message')

// apply patch
require('./patch')

var Broker = function(options){
  var that = this
  this.id = puid.generate()
  this.rep = new axon.RepSocket
  this.server = new rpc.Server(this.rep)
  this.options = options || {}
  this.redis = null
  this.redis_prefix = this.options.redis_prefix || 'spinal:'
  this.queue = null
  if(this.options.redis){
    this.redis = new Redis(this.options.redis)
    debug('[redis] initialize')
    var Queue = require('./queue')
    this.queue = new Queue(this, {redis: this.options.redis})
  }
  this.router = new Router(this, {
    redis: this.redis,
    redis_prefix: this.redis_prefix || 'spinal:'
  })
  this.metrics = (require('./metrics'))(this, this.options)
  if(this.options.restapi){
    var restapi = require('./restapi')
    this.restapi = new restapi(this, this.options)
  }

  this.server.expose('_handshake', function(data, reply, sock){
    debug('[_handshake] '+data.namespace+' ('+data.id+')')
    data.hostname = data.hostname || sock.remoteAddress 
    that.router.addNode(data)
    that.router.heartbeating(data)
    // create worker queue
    for (var i=0; i < data.methods.length; i++) {
      var item = data.methods[i]
      if (item.indexOf(':worker') > -1){
        var method = item.split(':')[0]
        if (that.queue) that.queue.addWorker(method)
      }
    }
    reply(null, that.router.listMethods())
  })

  this.server.expose('_heartbeat', function(data, reply){
    debug('_heartbeat '+data.id)
    that.router.heartbeating(data)
    reply(null, that.router.listMethods())
  })

  this.server.expose('_bye', function(id, reply){
    debug('_bye '+id)
    that.router.removeNode(id)
    reply(null, 'bye')
  })

  this.server.expose('_ping', function(data, reply){
    debug('_ping '+data.id)
    reply(null, 'pong')
  })

  this.server.expose('rpc', function(method, arg, options, reply){
    that.metrics.meter('broker.method.calls').mark()
    that.router.call(method, arg, options, reply)
  })

  this.server.expose('jobAdd', function(name, data, options, reply){
    /* istanbul ignore else */
    if (that.queue){
      var job = that.queue.addJob(name, data, options, function(err){
        reply(err, job.id)
      })
    } else {
      reply(new Error('Service queue unavailable on this broker'))
    }
  })

  // bind all messages
  // rep.on('message',function(req, reply){
  //   console.log(111);
  //   console.log(arguments['0'].args['1'].toString())
  // }
}
Broker.prototype.__proto__ = EventEmitter.prototype

Broker.prototype.start = function(port, done){
  var that = this
  debug('------- start -------')
  if(typeof port == 'function'){
    done = port
    port = 7557
  }
  this.rep.port = port = parseInt(port)
  this.rep.bind(port)
  this.server.sock.server.on('listening', function(){
    if(done) done.apply(that.rep, null)
  })
}

Broker.prototype.stop = function(done){
  var that = this
  debug('------- stop -------')
  for (var id in that.router.nodes){
    var loop = function(id){
      that.router.removeNode(id)
    }(id)
  }
  try {
    this.rep.close(function(){
      done && done.apply(this.rep, null)
    })
  } catch (e) {
    // console.error(e)
  }
  if (this.restapi) this.restapi.onstop()
  if (this.redis) {
    this.redis.quit()
    this.queue.onstop()
  }
}

module.exports = Broker
