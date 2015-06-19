var rpc = require('axon-rpc')
  , axon = require('axon')
  , rep = axon.socket('rep')
  , EventEmitter = require("events").EventEmitter
  , Router = require('./router')
  , _ = require('lodash')
  , Redis = require('ioredis')
  , debug = require('debug')('spinal:broker')

var server = new rpc.Server(rep)

var Broker = function(options){
  var that = this
  if(typeof options == 'undefined') options = {}
  this.redis = null
  this.redis_prefix = options.redis_prefix || 'spinal:'
  if(options.redis) this.redis = new Redis(options.redis)
  this.router = new Router({
    redis: this.redis,
    redis_prefix: this.redis_prefix
  })
  server.expose('_handshake', function(data, reply){
    debug('[_handshake] '+data.namespace+' ('+data.id+')')
    that.router.addNode(data)
    that.router.heartbeating(data)
    reply(null, that.router.listMethods())
  })

  server.expose('_heartbeat', function(data, reply){
    debug('_heartbeat '+data.id)
    that.router.heartbeating(data)
    reply(null, that.router.listMethods())
  })

  server.expose('_bye', function(id, reply){
    debug('_bye '+id)
    that.router.removeNode(id)
    reply(null, 'bye')
  })

  server.expose('_ping', function(data, reply){
    debug('_ping '+data.id)
    reply(null, 'pong')
  })

  server.expose('rpc', function(method, arg, options, reply){
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
  debug('------- start -------')
  if(typeof port == 'function'){
    done = port
    port = 7557
  }
  rep.port = port = parseInt(port)
  rep.bind(port)
  server.sock.server.on('listening',function(){
    if(done) done.apply(rep, null)
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
    rep.close()
  } catch (e) {
    // console.error(e)
  }
  if(done) done.apply(rep, null)
}

module.exports = Broker
