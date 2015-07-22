var axon = require('axon')
  , rpc = require('axon-rpc')
  , debug = require('debug')('spinal:broker')
  , crypto = require('crypto')
  , _ = require('lodash')
  , Measured = require('measured')
  , roundrobin = {}

var Router = function(broker, options){
  options = options || {}
  this.nodes = {}
  this.namespace = {}
  this.routing = {}
  this.broker = broker
  this.redis = options.redis
  this.redis_prefix = options.redis_prefix
  this.version = null
}

Router.prototype.roundrobin = function(method) {
  roundrobin[method] = roundrobin[method] || 0
  var len = this.routing[method].length
  var id = this.routing[method][roundrobin[method]++ % len]
  // if node it's not connected so we move to the next node
  if (this.nodes[id].req.connected == false) {
    debug('Node `' + id + '` not connected move to the next node')
    return this.roundrobin(method)
  }
  return id
}

Router.prototype.addNode = function(data) {
  if(data.namespace && data.namespace[0] === '$')
    return debug('[tmp-node] connected ' + data.namespace + '(' + data.id + ')')


  this.nodes[data.id] = _.clone(data)
  var obj = this.nodes[data.id]
  obj.req = axon.socket('req')
  obj.client = new rpc.Client(obj.req)
  obj.req.connect(data.port, data.hostname)
  obj.timer = new Measured.Timer()
  // add methods to routing
  for(var i in data.methods){
    this.addMethod(data.methods[i], data.id)
  }
  // namespace collection
  if (this.namespace[data.namespace]){
    this.namespace[data.namespace].push(data.id)
  }else{
    this.namespace[data.namespace] = [data.id]
  }
  this.version = crypto.createHash('md5')
    .update(_.keys(this.routing).join(',')).digest('hex')
  // this.syncAll()
}

Router.prototype.addMethod = function(fn_name, node_id){
  if (this.routing[fn_name]){
    if (this.routing[fn_name].indexOf(node_id) == -1){
      this.routing[fn_name].push(node_id)
    }
  }else{
    this.routing[fn_name] = [node_id]
  }
}

Router.prototype.removeNode = function(id){
  var node = this.nodes[id]
  if(!node) return false
  // remove methods from routing
  for(var i in node.methods){
    var fn = node.methods[i]
    if (this.routing[fn]){
      var i = this.routing[fn].indexOf(id)
      if (i > -1) this.routing[fn].splice(i,1)
      if (this.routing[fn].length == 0) delete this.routing[fn]
    }
  }
  // remove namespace from collection
  if (this.namespace[node.namespace]){
    var i = this.namespace[node.namespace].indexOf(id)
    if (i > -1) this.namespace[node.namespace].splice(i,1)
    if (this.namespace[node.namespace].length == 0){
      // remove from queue
      if(this.broker.queue) this.broker.queue.removeNamespace(node.namespace)
      delete this.namespace[node.namespace]
    }
  }
  node.req.close()
  delete this.nodes[id]
  this.version = crypto.createHash('md5')
    .update(_.keys(this.routing).join(',')).digest('hex')
  debug('[remove] '+node.namespace+' ('+id+')')
}

Router.prototype.call = function(method, arg, options, callback){
  var that = this
  arguments = [].slice.call(arguments)
  var method = arguments.shift()
  var reply = _.last(arguments)
  var timeout = null
  var call = function(){
    var id = that.routing[method][0]
    if(that.routing[method].length > 1) id = that.roundrobin(method)
    debug('[rpc] '+method+' @ '+id)
    var broker_watch = that.broker.metrics.timer('methods::' + method).start()
    var node_watch = that.nodes[id].timer.start()
    that.nodes[id].client.call('rpc', method.split('.')[1], arg, options, function(err, data, _options){
      clearTimeout(timeout)
      node_watch.end()
      broker_watch.end()
      if(typeof _options === 'undefined') _options = {}
      if (_options.cache && that.redis) {
        var key = that.redis_prefix + method + ':' + _options.cache.key
        that.redis.setex(key, _options.cache.ttl, JSON.stringify(data), function(err){
          debug('[cache.write] ' + method + ' @ ' + key)
        })
      }
      callback(err, data, options, _options)
    })
    timeout = setTimeout(function(){
      debug('[rpc] timeout! '+method+' @ '+id)
      callback(
        new Error('Timeout `router.call('+method+'@'+id+')` exceed '+options.timeout+'ms')
      , null, {}, {})
    }, options.timeout || 10000) // TODO: set timeout
  }
  if (this.routing[method]){
    if (options.cache_id && this.redis){
      this.redis.get(this.redis_prefix+method+':'+options.cache_id, function(err, result){
        if(result){
          callback(err, JSON.parse(result), {from_cache: true})
        } else {
          debug('[rpc] '+method+' (no)cache:'+options.cache_id)
          call()
        }
      })
    } else {
      call()
    }
  } else {
    debug('[rpc] '+method+' not found from all nodes')
    return reply(new Error('Spinal.Broker: method "' + method + '" does not exist'));
  }
}

// broadcast
// Router.prototype.syncAll = function(){
//   for(var i in this.nodes){
//     var node = this.nodes[i]
//     node.client.call('_sync', this.listMethods(), null)
//   }
//   debug('broadcast `_sync`')
// }

Router.prototype.heartbeating = function(data) {
  var that = this
  var node = this.nodes[data.id]
  if(node){
    if (node.heartbeatTimeout) clearTimeout(node.heartbeatTimeout)
    node.heartbeatTimeout = setTimeout(function(){
      that.removeNode(data.id)
    }, node.heartbeat_interval * 3) // 3 times of heartbeat
  }
}

Router.prototype.listMethods = function() {
  return {
    version: this.version,
    methods: _.keys(this.routing)
  }
}

Router.prototype.listNodes = function(){
  var result = []
  for (var i in this.nodes) {
    var node = this.nodes[i]
    result.push({
      id: i,
      namespace: node.namespace,
      connected: node.req.connected,
      methods: node.methods,
      hostname: node.hostname,
      port: node.port,
      timer: node.timer.toJSON(),
      heartbeat_interval: node.heartbeat_interval
    })
  }
  return _.sortBy(result, 'namespace')
}

/* istanbul ignore next */
Router.prototype.listNamespaces = function() {
  var namespaces = _.keys(this.namespace)
  return {
    version: crypto.createHash('md5').update(namespaces.join(',')).digest('hex'),
    namespaces: namespaces
  }
}

module.exports = Router
