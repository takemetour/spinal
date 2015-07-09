var Broker = require('../').Broker
var Spinal = require('../').Node
var _ = require('lodash')

var broker = new Broker({
  redis: 6379,
  restapi: 7577
})

broker.start(process.env.PORT || 7557, function(){
  console.log('Spinal:Broker listening...' + this.port)
  var spinal = new Spinal('spinal://127.0.0.1:7557', {namespace: 'a'})
  spinal.provide('check', function(arg, res){
    setTimeout(function(){res.send(arg)}, 1000)
  })
  spinal.worker('test', function(arg, res){
    setTimeout(function(){
      console.log('result', arg)
      res.log(1)
      res.log(2)
      res.log(3)
      if(arg.a % 4 == 0)
        res.error('sometime')
      else
        res.send(arg)
    }, 2000)
  })
  var j = 1
  setInterval(function(){
    spinal.job('test', {a: j}).save(function(err, id){
      j++
    })
  }, 1000)
  setInterval(function(){
    spinal.call('check', function(){ console.log('.') })
  }, 1000)
  spinal.start()
})

setTimeout(function(){
  broker.queue.setConcurrent('a.test', 5)
}, 11000)

setTimeout(function(){
  broker.queue.setConcurrent('a.test', 2)
}, 21000)

setTimeout(function(){
  broker.queue.setConcurrent('a.test', 7)
}, 35000)
