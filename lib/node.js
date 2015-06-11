var rpc = require('axon-rpc')
  , axon = require('axon')
  , rep = axon.socket('rep')
  , req = axon.socket('req')
  , _ = require('lodash')
  , puid = new (require('puid'))
  , EventEmitter = require("events").EventEmitter

var URLparse = require('url').parse
var _reserved_namespace = ['broker', 'queue']
 
function getPort (cb) {
  var server = require('net').createServer()
  server.listen(0)
  server.on('listening', function () {
    port = server.address().port
    server.once('close', function () {
      cb(port)
    })
    server.close()
  })
}

function errSpinal(msg){
  var err = new Error(msg)
  err.name = 'SpinalNode'
  return err
}

var server = new rpc.Server(rep)
var client = new rpc.Client(req)

var Spinal = function(url, options){
  if (typeof url == 'object'){
    options = url
    url = null
  }
  if (typeof url == 'string'){
    var url = URLparse(url)
    if (!url.host) url.host = '127.0.0.1'
    if (!url.port) url.port = '7557'
  }
  url.port = parseInt(url.port)
  if (typeof options == 'undefined') options = {}

  this.hostname = '127.0.0.1' // TODO: dynamic IP
  this.port = options.port
  this.namespace = options.namespace || 'global'
  this.global_namespace = []
  this.timeout = {}
  this._methods = {}
  this._binding = {}
  var that = this
  
  // validate
  if (_reserved_namespace.indexOf(options.namespace) > -1)
    throw new Error("`" + options.namespace + "` may not be used as a namespace")

  // spinal node initilization
  var init = function(port, hostname){
    var data = {
      id: puid.generate(),
      namespace: that.namespace,
      hostname: that.hostname, // TODO: dynamic IP
      port: that.port,
      methods: _.keys(that._methods)
    }
    rep.bind(port)
    var handshake = function(data){
      client.call('_handshake', data, function(err, res){
        console.log(res)
        that.emit('handshake', client)
        var ping = function(){
          if (that.timeout.heartbeat) clearTimeout(that.timeout.heartbeat)
          if (client.sock.connected){
            client.call('_heartbeat', {id: data.id}, null)
            that.timeout.heartbeat = setTimeout(ping, 5000)
            that
          }
        }
        setTimeout(ping, 5000)
      })
    }
    req.on('connect', function(){ handshake(data) })
    // req.on('error', function(){ console.error('error') })
    // req.on('reconnect attempt', function(){ that.is_connect = false })
    rep.on('bind',function(){
      that.emit('listening')
      // connect to broker
      req.connect(url.port, url.hostname)
    })
  }

  // start listening for broker request
  if(this.port)
    init(this.port, this.hostname)
  else
    getPort(function(port){ 
      that.port = port
      init(port, this.hostname)
    })

  // broker broadcast namespace
  server.expose('_namespace', function(err, namespaces){
  })
  
  this.methods = function(name, fn){
    var fn_name = that.namespace+'.'+name
    server.expose(fn_name, fn)

    // test
    that._methods[fn_name] = function(){
      console.log('-----')
      arguments = [].slice.call(arguments)
      arguments.unshift(fn_name)
      console.log(arguments)
      client.call.apply(client, arguments)
    }

    var obj = {}
    obj[that.namespace] = {get: function(){ return that._methods; }}
    Object.defineProperties(that, obj)
  }

}
// event emitter
Spinal.prototype.__proto__ = EventEmitter.prototype
Spinal.prototype.namespacing = function(namespaces){

}

module.exports = Spinal
