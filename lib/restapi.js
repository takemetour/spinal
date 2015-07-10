var express = require('express')
var kue = require('kue')
var debug = require('debug')('spinal:restapi')
var _ = require('lodash')
var http = require('http')

var RestAPI = function(broker, options){
  var app = this.app = express()
  app.get('/', function(req, res){
    res.sendFile(__dirname + '/dashboard/index.html')
  })
  app.use('/nodes', function(req, res){
    res.json(broker.router.listNodes())
  })
  app.use('/methods/', function(req, res){
    var result = broker.router.listMethods()
    res.header('X-methods-version', result.version)
    res.json(result.methods)
  })
  if(broker.queue){
    app.get('/queue/worker', function(res, res){
      res.json(broker.queue.workerCount())
    })
    app.get('/queue/worker/:worker/concurrent/:concurrent', function(req, res){
      broker.queue.setConcurrent(req.params.worker, req.params.concurrent)
      res.json(broker.queue.workerCount(req.params.worker))
    })
    app.get('/queue/count', function(req, res){
      broker.queue.jobCount(function(err, data){
        res.json(data)
      })
    })
    app.use('/queue/', kue.app)
  } else {
    app.all('/queue*', function(req, res){
      res.status(503).send('Service queue unavailable on this worker')
    })
  }
  app.use('/metrics', function(req, res){
    res.json(broker.metrics.toJSON())
  })
  app.use(express.static(__dirname + '/dashboard'))
  app.use(function(req, res){
    res.status(404).send('404 File not found')
  })
  this.server = http.createServer(app).listen(options.restapi, function(){
    debug('RestAPI ready! ... listening :' + options.restapi)
  })
  return this
}

RestAPI.prototype.onstop = function(){
  this.server.close()
}

module.exports = RestAPI
