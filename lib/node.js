var rpc = require('axon-rpc')
  , axon = require('axon')
  , _ = require('lodash')
  , puid = new (require('puid'))
  , debug = require('debug')('spinal:node')
  , EventEmitter = require("events").EventEmitter

var URLparse = require('url').parse
var _reserved_namespace = ['broker', 'queue', 'on', 'emit', 'methods']

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

  var rep = axon.socket('rep')
  var req = axon.socket('req')
  this.server = new rpc.Server(rep)
  this.client = new rpc.Client(req)

  this.hostname = '127.0.0.1' // TODO: dynamic IP
  this.port = options.port
  this.namespace = options.namespace || 'global'
  this.timeout = {}
  this._broker_data = {
    version: null,
    methods: []
  }
  var that = this
  
  // validate
  if (_reserved_namespace.indexOf(options.namespace) > -1)
    throw new Error("`" + options.namespace + "` may not be used as a namespace")

  // internal methods
  this._methods = {}
  var prop_config = {}
  prop_config[this.namespace] = { get: function(){ return this._methods } }
  Object.defineProperties(this, prop_config)

  // spinal node initilization
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
      port: that.port,
      methods: export_methods
    }
    rep.bind(port)
    var handshake = function(data){
      that.client.call('_handshake', data, function(err, res){
        that.methodsAlias(res)
        that.emit('handshake', that.client)
        var ping = function(){
          if (that.timeout.heartbeat) clearTimeout(that.timeout.heartbeat)
          if (that.client.sock.connected){
            that.client.call('_heartbeat', {
              id: data.id, version: that._broker_data.version
            }, function(err, res){
              // console.log('beating', res)
              that.methodsAlias(res)
            })
            that.timeout.heartbeat = setTimeout(ping, 5000)
            that
          }
        }
        setTimeout(ping, 5000)
      })
    }
    // TODO: error handle in the future
    // req.on('error', function(){ console.error('error') })
    // req.on('reconnect attempt', function(){ that.is_connect = false })
    req.on('connect', function(){ handshake(data) })
    rep.on('bind',function(){
      that.emit('listening')
      // after listening ready connect to broker
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

Spinal.prototype.methods = function(name, fn){
  var that = this
  if (this._methods[name])
    throw new Error("`" + name + "` method already exitst")
  debug('register method('+name+')')
  var fn_name = this.namespace+'.'+name
  this.server.expose(name, fn)

  // test
  this._methods[name] = function(){
    console.log('-----')
    arguments = [].slice.call(arguments)
    arguments.unshift(fn_name)
    console.log(arguments)
    that.client.call.apply(that.client, arguments)
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
