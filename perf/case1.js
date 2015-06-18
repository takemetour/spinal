var Spinal = require('../').Node;
var async = require('async')

var spinal = new Spinal('spinal://127.0.0.1:5000', {
  namespace: 'frontend'
});

var getTime = function(){ return new Date().getTime() }
var start = getTime()
var n = 10000
var c = 250
var _message = null

spinal.start(function(){
  console.log(this.namespace+' ready!')
  var loop = []
  for (var i = 0; i < n; i++) {
    loop.push(i)
  }

  var q = async.queue(function(i, done){
    spinal.call('blackman.loadData', 'something', function(err, data){
    // spinal.blackman.ping('hey!', function(err, stock){
      if(i%1000 == 0){
        console.log('.')
        _message = data
      }
      done()
    })
  }, c)
  q.drain = function(){
    var usage = getTime()-start
    console.log('requests: ' + n)
    console.log('con-current: ' + c)
    console.log('total usage: ' + usage + 'ms')
    console.log('per transaction: ' + usage/n + ' ms')
    console.log('json transaction size: ' + JSON.stringify(_message).length + ' bytes')
    console.log('total json transfer: ' + (JSON.stringify(_message).length*n/1024/1024).toFixed(2) + ' MB')
    spinal.stop()
    process.exit(0)
  }
  q.push(loop)

  // async.eachSeries(loop, function(i, done){
  //   spinal.blackman.loadStock('NASDAQ:AAPL', function(err, stock){
  //     done()
  //   })
  // }, function(err){
  //   console.log('done')
  //   console.log(getTime()-start)
  //   spinal.stop()
  // })
})

