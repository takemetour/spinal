var axon = require('axon')
  , rpc = require('axon-rpc')
  , debug = require('debug')('spinal:broker')
  , crypto = require('crypto')
  , _ = require('lodash')
  , random = require("random-js")()

var Router = function(options){
  if(typeof options == 'undefined') options = {}
  this.nodes = {}
  this.namespace = {}
  this.routing = {}
  this.redis = options.redis
  this.redis_prefix = options.redis_prefix
  this.version = null
}

Router.prototype.addNode = function(data) {
  this.nodes[data.id] = data
  var obj = this.nodes[data.id]
  obj.req = axon.socket('req')
  obj.client = new rpc.Client(obj.req)
  obj.req.connect(data.port, data.hostname)
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
    if (this.namespace[node.namespace].length == 0) delete this.namespace[node.namespace]
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
  var call = function(){
    // TODO: improve routing performance / more balancing
    var id = that.routing[method][0]
    if(that.routing[method].length > 1) id = random.pick(that.routing[method])
    debug('[rpc] '+method+' @ '+id)
    that.nodes[id].client.call('rpc', method.split('.')[1], arg, options, function(err, data, _options){
      if (options.cache && that.redis) {
        that.redis.setex(that.redis_prefix+method+':'+options.cache.key, options.cache.ttl, JSON.stringify(data))
      }
      callback(err, data, options)
    })
  }
  if (this.routing[method]){
    if (options.cache_id && this.redis){
      this.redis.get(this.redis_prefix+method+':'+options.cache_id, function(err, result){
        if(result)
          callback(err, JSON.parse(result), {from_cache: true})
        else call()
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
  var id = this.nodes[data.id]
  if (id.heartbeatTimeout) clearTimeout(id.heartbeatTimeout)
  this.nodes[data.id].heartbeatTimeout = setTimeout(function(){
    that.removeNode(data.id)
  }, 7000)
}

Router.prototype.listMethods = function() {
  return {
    version: this.version,
    methods: _.keys(this.routing)
  }
}

Router.prototype.listNamespaces = function() {
  var namespaces = _.keys(this.namespace)
  return {
    version: crypto.createHash('md5').update(namespaces.join(',')).digest('hex'),
    namespaces: namespaces
  }
}

module.exports = Router