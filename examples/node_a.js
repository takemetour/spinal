var Spinal = require('../').Node;

var spinal = new Spinal('spinal://127.0.0.1:7557', {
  namespace: 'midman'
});

spinal.methods('test', function(a, b, done){
  console.log('from methods', a, b)
  done(null, a, b)
});

spinal.on('handshake', function(){
  console.log('node_a: `'+this.namespace+'` ready')
})


// spinal://db1,db2
