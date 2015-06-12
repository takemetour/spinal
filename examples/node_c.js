var Spinal = require('../').Node

var spinal = new Spinal('spinal://127.0.0.1:7557', {
  namespace: 'antman'
})

spinal.methods('listStock', function(a, b, done){
  console.log('from list stock methods', a, b)
  done(null, a, b)
})

spinal.on('handshake', function(){
  console.log('node_c: handshake')
})

// spinal.midman.test(1 , 2, function(err, result){
//   console.log(err)
//   console.log(result)
// })


// spinal://db1,db2



// spinal://db1,db2