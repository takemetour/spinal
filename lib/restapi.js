var express = require('express')
var kue = require('kue')
var debug = require('debug')('spinal:restapi')
var _ = require('lodash')
var http = require('http')

var RestAPI = function(broker, options){
  var app = this.app = express()
  app.get('/', function(req, res){
    res.sendFile(__dirname + '/dashboard.html')
  })
  app.use('/methods/', function(req, res){
    var result = broker.router.listMethods()
    res.header('X-methods-version', result.version)
    res.json(result.methods)
  })
  app.get('/queue/worker', function(res, res){
    if(broker.queue){
      res.json(broker.queue.workerCount())
    }
  })
  app.get('/queue/count', function(req, res){
    if(broker.queue){
      broker.queue.jobCount(function(err, data){
        res.json(data)
      })
    }
  })
  app.use('/queue/', kue.app)
  app.use('/metrics', function(req, res){
    res.json(broker.metrics.toJSON())
  })
  this.server = http.createServer(app).listen(options.restapi, function(){
    debug('RestAPI listening...' + options.restapi)
  })
  return this
}

RestAPI.prototype.onstop = function(){
  this.server.close()
}

module.exports = RestAPI
