var axon = require('axon')
  , rpc = require('axon-rpc')
  , debug = require('debug')('spinal:broker')
  , crypto = require('crypto')
  , _ = require('lodash')

var Router = function(){
  this.nodes = {}
  this.namespace = {}
  this.routing = {}
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

Router.prototype.call = function(arguments){
  arguments = [].slice.call(arguments)
  var method = arguments.shift()
  var reply = _.last(arguments)
  if (this.routing[method]){
    // TODO: multi routing / load balacing
    var id = this.routing[method][0]
    arguments.unshift(method.split('.')[1])
    this.nodes[id].client.call.apply(this.nodes[id].client, arguments)
    debug('[rpc] '+method+' @ '+id)
  } else {
    return reply({ error: 'Spinal: method "' + method + '" does not exist' });
  }
}

Router.prototype.removeNode = function(id){
  var obj = this.nodes[id]
  // remove methods from routing
  for(var i in obj.methods){
    var fn = obj.methods[i]
    if (this.routing[fn]){
      var i = this.routing[fn].indexOf(id)
      if (i > -1) this.routing[fn].splice(i,1)
      if (this.routing[fn].length == 0) delete this.routing[fn]
    }
  }
  // remove namespace from collection
  if (this.namespace[obj.namespace]){
    var i = this.namespace[obj.namespace].indexOf(id)
    if (i > -1) this.namespace[obj.namespace].splice(i,1)
    if (this.namespace[obj.namespace].length == 0) delete this.namespace[obj.namespace]
  }
  obj.req.close()
  this.version = crypto.createHash('md5')
    .update(_.keys(this.routing).join(',')).digest('hex')
  debug('[remove] '+id)
}

Router.prototype.syncAll = function(){
  for(var i in this.nodes){
    var node = this.nodes[i]
    node.client.call('_sync', this.listMethods(), null)
  }
  debug('broadcast `_sync`')
}

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