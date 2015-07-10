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
    var port = server.address().port
    server.once('close', function () {
      cb(port)
    })
    server.close()
  })
}

//
// Spinal core
//

var Spinal = function(url, options){
  var that = this
  if (typeof options == 'undefined') options = {}

  var rep = axon.socket('rep')
  var req = axon.socket('req')
  this.id = puid.generate()
  this.server = new rpc.Server(rep)
  this.client = new rpc.Client(req)
  this.broker_url = url
  this.hostname = null // '127.0.0.1' // TODO: dynamic IP
  this.port = parseInt(options.port)
  this.namespace = options.namespace
  this.timeout = {}
  this.initialized = false
  this._broker_data = {
    version: null,
    methods: []
  }
  if (options.heartbeat_interval) HEARTBEAT_INTERVAL = parseInt(options.heartbeat_interval)

  // validate
  if (typeof this.broker_url == 'undefined')
    throw new Error("Spinal needs a broker url in the first argument")
  if (typeof this.namespace == 'undefined')
    throw new Error("Spinal needs `options.namespace` to initialize")
  if (_reserved_namespace.indexOf(this.namespace) > -1)
    throw new Error("`" + this.namespace + "` may not be used as a namespace")

  // internal methods
  this._methods = {}

  // stats
  this.stats = {
    reconnected: 0
  }

  // TODO: broker broadcast namespace
  // this.server.expose('_message', function(err, data){
  //   debug('broker message', data)
  //   console.log(arguments)
  // })

  this.server.expose('rpc', function(name, arg, options, reply){
    // TODO: options like caching, error, ...
    /* istanbul ignore else */
    if (that._methods[name]){
      debug(that.namespace + '[rpc] ' + name)
      reply._options = options
      that._methods[name](arg, reply)
    } else {
      debug(that.namespace + '[rpc] ' + name + ' method not found')
      reply(new Error(that.namespace + " no method found `" + that.name + "`"))
    }
  })

  debug(that.namespace+'('+that.id+') new node')

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

  if (that.initialized) return callback && callback.apply(this, null)

  var init = function(port, hostname){
    debug(that.namespace+'('+that.id+') start() at :'+port)
    // export methods name for broker
    var export_methods = []
    for(var i in that._methods){
      export_methods.push(that.namespace+'.'+i)
    }
    var data = {
      id: that.id,
      namespace: that.namespace,
      hostname: that.hostname, // TODO: dynamic IP
      heartbeat_interval: HEARTBEAT_INTERVAL,
      port: port,
      methods: export_methods
    }
    var handshake = function(data){
      that.client.call('_handshake', data, function(err, res){
        debug('handshaked with broker')
        that.emit('handshake', that.client)
        if (callback) {
          callback.apply(that, null)
          callback = null
        }
        var ping = function(){
          clearTimeout(that.timeout.heartbeat)
          if (that.client.sock.connected){
            that.client.call('_heartbeat', {
              id: data.id, version: that._broker_data.version
            }, function(err, res){
              // something ...
            })
            that.timeout.heartbeat = setTimeout(ping, HEARTBEAT_INTERVAL)
          }
        }
        that.timeout.heartbeat = setTimeout(ping, HEARTBEAT_INTERVAL)
      })
    }
    // TODO: error handle in the future
    if (!that.initialized){
      that.initialized = true
      // req.on('error', function(err){ console.error(that.namespace+'('+that.id+') req.error : ', err) })
      req.on('reconnect attempt', function(){
        that.stats.reconnected++
        debug(that.id + ' reconnecting...')
      })
      req.on('connect', function(){ handshake(data) })
      rep.on('bind', function(){
        that.emit('listening')
        // after listening ready connect to broker
        req.connect(url.port, url.hostname)
      })
    }
    rep.bind(port)
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
  var that = this
  var rep = this.server.sock
  var req = this.client.sock
  if(req.socks.length > 0){
    // try to close sockets
    var close = function(done){
      try {
        req.close()
        rep.close(done)
      } catch (e) {}
    }
    var stopTimeout = setTimeout(function(){
      debug(that.namespace+'('+that.id+') stop() by timeout', that.id)
      close(fn)
    }, HEARTBEAT_INTERVAL*2)
    this.client.call('_bye', this.id, function(){
      clearTimeout(stopTimeout)
      close(fn)
      debug(that.namespace+'('+that.id+') stop()')
    })
  } else {
    fn && fn()
    // fn = null
  }
}

Spinal.prototype.ping = function(fn){
  this.client.call('_ping', this.id, fn)
}

//
// RPC
//

Spinal.prototype.provide = function(name, fn){
  if (this._methods[name])
    throw new Error("`" + name + "` method already exists")
  debug('register method('+name+')')
  var fn_name = this.namespace+'.'+name

  // middleware spinal rpc
  this._methods[name] = function(arg, callback){
    // TODO: timeout handle

    // var arguments = [].slice.call(arguments)
    var options = {}
    var reply = {
      send: function(data){
        callback(null, data, options)
      },
      error: function(err){
        if(typeof err === 'string') err = new Error(err)
        err.options = options
        callback(err)
      },
      log: function(data){
        if(!options.logs) options.logs = []
        options.logs.push(String(data))
      },
      cache: function(ttl, key){
        options.cache = {
          ttl: ttl,
          key: key
        }
      }
      // reject: function(){}
    }
    fn(arg, reply, options)
  }
}

Spinal.prototype.unprovide = function(name){
  if(this._methods[name]){
    delete this._methods[name]
    return true
  }
}

Spinal.prototype.call = function(name, arg, options, callback){
  if (name.indexOf('.') === -1) name = this.namespace + '.' + name
  if (typeof arg === 'function'){
    callback = arg
    arg = null
    options = {}
    arguments = [name, arg, options, callback]
  } else if (typeof options === 'function'){
    callback = options
    options = {}
    arguments = [name, arg, options, callback]
  } else arguments = [].slice.call(arguments)

  // middleware spinal rpc
  callback = arguments.pop()
  arguments.push(function(err, data, options){
    callback(err, data, options)
  })

  arguments.unshift('rpc')
  // TODO: timeout
  this.client.call.apply(this.client, arguments)
}

//
// Worker
//

Spinal.prototype.worker = function(name, fn){
  this.provide.apply(this, [name + ':worker', fn])
}

Spinal.prototype.job = function(name, data){
  if (name.indexOf('.') == -1) name = this.namespace + '.' + name
  var that = this
  var options = {}
  return {
    priority: function(priority){ options.priority = priority; return this },
    attempts: function(attempts){ options.attempts = attempts; return this },
    backoff: function(backoff){ options.backoff = backoff; return this },
    ttl: function(ttl){ options.ttl = ttl; return this },
    delay: function(delay){ options.delay = delay; return this },
    save: function(callback){
      if (typeof callback == 'undefined') callback = function(){}
      var arg = ['jobAdd', name, data, options, callback]
      that.client.call.apply(that.client, arg)
    }
  }

}

module.exports = Spinal
