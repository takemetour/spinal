var rpc = require('axon-rpc')
  , axon = require('axon')
  , rep = axon.socket('rep')
  , EventEmitter = require("events").EventEmitter
  , Router = require('./router')
  , _ = require('lodash')
  , debug = require('debug')('spinal:broker')

var server = new rpc.Server(rep)
var router = new Router

var Broker = function(){
  server.expose('_heartbeat', function(data, reply){
    debug('_heartbeat '+data.id)
    router.heartbeating(data)
    reply(null, router.listMethods())
  })
  server.expose('_handshake', function(data, reply){
    debug('[_handshake] '+data.id)
    router.addNode(data)
    router.heartbeating(data)
    reply(null, router.listMethods())
  })
  server.expose('rpc', function(arg, reply){
    router.call(arguments)
  })
  // bind all messages
  // rep.on('message',function(req, reply){
  //   console.log(111);
  //   console.log(arguments['0'].args['1'].toString())
  // }
}
Broker.prototype.__proto__ = EventEmitter.prototype

Broker.prototype.start = function(port, done){
  if(typeof port == 'function'){
    done = port
    port = 7557
  } else {
    port = parseInt(port || 7557)
  }
  rep.port = port
  rep.bind(port)
  server.sock.server.on('listening',function(){
    if(done) done(rep)
  })
},
Broker.prototype.stop = function(){}

module.exports = function(options){
  return new Broker(options)
}