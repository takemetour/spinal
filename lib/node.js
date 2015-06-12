var rpc = require('axon-rpc')
  , axon = require('axon')
  , _ = require('lodash')
  , puid = new (require('puid'))
  , debug = require('debug')('spinal:node')
  , EventEmitter = require("events").EventEmitter

var URLparse = require('url').parse
var _reserved_namespace = ['broker', 'queue', 'on', 'emit', 'methods']
var HEARTBEAT_INTERVAL = 5000
//
// helper
//

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

//
// Spinal core
//

var Spinal = function(url, options){
  var that = this
  if (typeof url == 'object'){
    options = url
    url = null
  }

  if (typeof options == 'undefined') options = {}

  var rep = axon.socket('rep')
  var req = axon.socket('req')
  this.server = new rpc.Server(rep)
  this.client = new rpc.Client(req)
  this.broker_url = url || 'spinal://127.0.0.1:7557'
  this.hostname = null // '127.0.0.1' // TODO: dynamic IP
  this.port = parseInt(options.port)
  this.namespace = options.namespace || 'global'
  this.timeout = {}
  this.initialized = false
  this._broker_data = {
    version: null,
    methods: []
  }
  if (options.heartbeat_interval) HEARTBEAT_INTERVAL = parseInt(options.heartbeat_interval)
  
  // validate
  if (_reserved_namespace.indexOf(options.namespace) > -1)
    throw new Error("`" + options.namespace + "` may not be used as a namespace")

  // internal methods
  this._methods = {}
  var prop_config = {}
  prop_config[this.namespace] = { get: function(){ return this._methods } }
  Object.defineProperties(this, prop_config)


  // TODO: broker broadcast namespace
  this.server.expose('_message', function(err, data){
    debug('broker message', data)
    // console.log(arguments)
  })

}
//
// Prototype
//

// event emitter
Spinal.prototype.__proto__ = EventEmitter.prototype

// spinal node initilization
Spinal.prototype.start = function(callback){
  var that = this
  var rep = this.server.sock
  var req = this.client.sock

  var url = URLparse(this.broker_url)
  url.port = parseInt(url.port)

  var init = function(port, hostname){
    // export methods name for broker
    var export_methods = []
    for(var i in that._methods){
      export_methods.push(that.namespace+'.'+i)
    }
    var data = {
      id: puid.generate(),
      namespace: that.namespace,
      hostname: that.hostname, // TODO: dynamic IP
      port: port,
      methods: export_methods
    }
    rep.bind(port)
    var handshake = function(data){
      that.client.call('_handshake', data, function(err, res){
        that.methodsAlias(res)
        that.emit('handshake', that.client)
        that.initialized = true
        if (callback) callback.apply(that,null)
        var ping = function(){
          if (that.timeout.heartbeat) clearTimeout(that.timeout.heartbeat)
          if (that.client.sock.connected){
            that.client.call('_heartbeat', {
              id: data.id, version: that._broker_data.version
            }, function(err, res){
              that.methodsAlias(res)
            })
            that.timeout.heartbeat = setTimeout(ping, HEARTBEAT_INTERVAL)
          }
        }
        setTimeout(ping, HEARTBEAT_INTERVAL)
      })
    }
    // TODO: error handle in the future
    // req.on('error', function(err){ console.error('error', err) })
    req.on('reconnect attempt', function(){ debug('reconnecting...') })
    req.on('connect', function(){ handshake(data) })
    rep.on('bind',function(){
      that.emit('listening')
      // after listening ready connect to broker
      req.connect(url.port, url.hostname)
    })
  }

  // start listening for broker request
  if(isFinite(this.port))
    init(this.port, this.hostname)
  else
    getPort(function(port){
      that.port = port
      init(port, that.hostname)
    })

}
// spinal node destructor
Spinal.prototype.stop = function(fn){
  this.server.sock.close()
  this.client.sock.close()
  if(fn) fn()
}

Spinal.prototype.methods = function(name, fn){
  var that = this
  if (this._methods[name])
    throw new Error("`" + name + "` method already exists")
  debug('register method('+name+')')
  var fn_name = this.namespace+'.'+name
  this.server.expose(name, fn)

  // call internal
  this._methods[name] = function(){
    fn.apply(null, arguments)
  }
}

Spinal.prototype.methodsAlias = function(data){
  var _data = this._broker_data
  var that = this
  if (_data.version == data.version) return true

  // add new method
  var new_methods = _.difference(data.methods, _data.methods)
  for (var i in new_methods){
    var item = new_methods[i].split('.')
    var loop = function(item){
      if (that.namespace == item[0]) return false
      if (!that[item[0]]) that[item[0]] = {}

      debug('register broker method('+new_methods[i]+')')
      that[item[0]][item[1]] = function(){
        var fn_name = item[0]+'.'+item[1]
        arguments = [].slice.call(arguments)
        arguments.unshift('rpc', fn_name)
        debug('call broker ('+fn_name+')', arguments)
        that.client.call.apply(that.client, arguments)
      }
    }(item)
  }
  _data.version = data.version
  // TODO: remove old method?
  // var del_methods = _.difference(_data.methods, data.methods)
  // for (var i in del_methods){
  //   var item = del_methods[i].split('.')
  //   if(this[item[0]]){
  //     if(this[item[1]]){
  //       debug('remove broker method('+del_methods[i]+')')
  //       delete this[item[0]][item[1]]
  //     }
  //   }
  // }
  // console.log(this)
}

module.exports = Spinal
