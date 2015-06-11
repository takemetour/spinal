var Spinal = require('../').Node;

var spinal = new Spinal('spinal://127.0.0.1:7557', {
  namespace: 'blackman'
});

spinal.methods('loadStock', function(a, b, done){
  console.log('from loadStock methods', a, b);
  done(null, a, b);
});

spinal.start(function(){
  console.log('node_b: `'+this.namespace+'` ready')
  console.log(spinal.midman)
  spinal.midman.test(1,3,function(){
    console.log(arguments)
  })
})

var spinal2 = new Spinal('spinal://127.0.0.1:7557', {
  namespace: 'cat', port: 3009
});
// spinal2.start()
