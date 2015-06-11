var Spinal = require('../').Node;
var async = require('async')

var spinal = new Spinal('spinal://127.0.0.1:5000', {
  namespace: 'frontend'
});

var getTime = function(){ return new Date().getTime() }
var start = getTime()
var n = 1000
var c = 250

spinal.start(function(){
  console.log(this.namespace+' ready!')
  var loop = []
  for (var i = 0; i < n; i++) {
    loop.push(i)
  }

  var q = async.queue(function(i, done){
    spinal.blackman.loadData('something', function(err, stock){
    // spinal.blackman.ping('hey!', function(err, stock){
      if(i%100 == 0) console.log('.')
      done()
    })
  }, c)
  q.drain = function(){
    console.log('done')
    var usage = getTime()-start
    console.log('requests: ' + n)
    console.log('con-current: ' + c)
    console.log('usage: ' + usage)
    console.log('per transaction: ' + usage/n + ' ms')
    spinal.stop()
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

