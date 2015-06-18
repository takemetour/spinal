var Spinal = require('../').Node

var spinal = new Spinal('spinal://127.0.0.1:7557', {
  namespace: 'midman', port: 3001, heartbeat_interval: 1000
});

spinal.provide('test', function(data, res){
  console.log('from methods', data)
  res.send(data)
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
