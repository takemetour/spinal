var rpc = require('axon-rpc')
  , axon = require('axon')
  , EventEmitter = require("events").EventEmitter
  , Router = require('./router')
  , _ = require('lodash')
  , Redis = require('ioredis')
  , debug = require('debug')('spinal:broker')

var Broker = function(options){
  var that = this
  this.rep = axon.socket('rep')
  this.server = new rpc.Server(this.rep)
  if(typeof options == 'undefined') options = {}
  this.redis = null
  this.redis_prefix = options.redis_prefix || 'spinal:'
  this.queue = null
  if(options.redis){
    this.redis = new Redis(options.redis)
    debug('[redis] initialize')
  }
  this.router = new Router(this, {
    redis: this.redis,
    redis_prefix: this.redis_prefix
  })
  if(options.redis){
    var Queue = require('./queue')
    this.queue = new Queue(this, {redis: options.redis})
  }
  this.metrics = (require('./metrics'))(this, options)
  if(options.restapi){
    var restapi = require('./restapi')
    this.restapi = new restapi(this, options)
  }

  this.server.expose('_handshake', function(data, reply){
    debug('[_handshake] '+data.namespace+' ('+data.id+')')
    that.router.addNode(data)
    that.router.heartbeating(data)
    // create worker queue
    for (var i=0; i < data.methods.length; i++) {
      var item = data.methods[i]
      if (item.indexOf(':worker') > -1){
        var method = item.split(':')[0]
        that.queue.addWorker(method)
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
    var job = that.queue.addJob(name, data, options, function(err){
      reply(err, job.id)
    })
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
},

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
