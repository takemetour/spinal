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
  if(options.redis){
    this.redis = new Redis(options.redis)
    debug('[redis] initialize')
  }
  this.router = new Router({
    redis: this.redis,
    redis_prefix: this.redis_prefix
  })
  this.server.expose('_handshake', function(data, reply){
    debug('[_handshake] '+data.namespace+' ('+data.id+')')
    that.router.addNode(data)
    that.router.heartbeating(data)
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
    that.router.call(method, arg, options, reply)
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
  this.server.sock.server.on('listening',function(){
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
    this.rep.close()
  } catch (e) {
    // console.error(e)
  }
  if (this.redis) this.redis.quit()
  if (done) done.apply(this.rep, null)
}

module.exports = Broker
