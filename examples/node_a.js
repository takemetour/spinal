var Spinal = require('../').Node

var spinal = new Spinal('spinal://127.0.0.1:7557', {
  namespace: 'midman', port: 3001, heartbeat_interval: 1000
});

spinal.methods('test', function(a, b, done){
  console.log('from methods', a, b)
  done(null, a, b)
});

spinal.start(function(){
  console.log('node_a: `'+this.namespace+'` ready')
})

// setTimeout(function(){
//   spinal.stop()
// }, 5000);

// spinal.midman.test(1,2,function(err, result){
//   console.log('>>',result)
// })
