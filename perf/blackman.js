var Spinal = require('../').Node;

var spinal = new Spinal('spinal://127.0.0.1:5000', {
  namespace: 'blackman'
});

spinal.methods('loadData', function(stock_id, done){
  var data = require('./fixture')
  done(null, data);
});

spinal.methods('ping', function(stock_id, done){
  done(null, {ping:'ok'});
});

spinal.start(function(){
  console.log(this.namespace+' ready!')
})

// spinal://db1,db2
