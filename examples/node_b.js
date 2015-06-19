var Spinal = require('../').Node

var spinal = new Spinal('spinal://127.0.0.1:5000', {
  namespace: 'blackman'
})

spinal.provide('loadStock', function(data, res){
  console.log('from loadStock methods', data)
  res.send(data)
})

spinal.start(function(){
  console.log('node_b: `'+this.namespace+'` ready')
  // spinal.call('midman.test', {a:1, b:2}, function(err, data){
  //   console.log(data)
  // })
  // spinal.call('loadStock', {stock_id:'NASDAQ:AAPL'}, function(err, data){
  //   console.log(data)
  // })
  setTimeout(function(){
    spinal.call('midman.tryCache', {stock_id:'NASDAQ:AAPL'}, {cache_id:'date'}, function(err, data, options){
      console.log(arguments)
    })
  }, 1000)
})

process.on('SIGINT', function() {
  spinal.stop(process.exit)
});

var spinal2 = new Spinal('spinal://127.0.0.1:7557', {
  namespace: 'cat', port: 3009
})
// spinal2.start()
