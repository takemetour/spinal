var Spinal = require('../').Node;

var spinal = new Spinal('spinal://127.0.0.1:7557', {
  namespace: 'blackman'
});

spinal.methods('loadStock', function(a, b, done){
  console.log('from loadStock methods', a, b);
  done(null, a, b);
});

spinal.on('handshake', function(){
  console.log('node_b: handshake')
})


// spinal://db1,db2



// spinal://db1,db2