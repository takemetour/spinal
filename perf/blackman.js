var Spinal = require('../').Node;

var spinal = new Spinal('spinal://127.0.0.1:5000', {
  namespace: 'blackman'
});

var data = require('./fixture.js')
// var data = require('./fixture.aapl.js')
spinal.provide('loadData', function(stock_id, res){
  res.send(data)
});

spinal.provide('loadDataCache', function(stock_id, res){
  res.cache(1000, 'KEY')
  res.send(data)
});

spinal.provide('ping', function(stock_id, res){
  res.send({ping:'ok'})
});

spinal.start(function(){
  console.log(this.namespace+' ready!')
})
