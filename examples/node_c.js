var Spinal = require('../').Node

var spinal = new Spinal('spinal://127.0.0.1:7557', {
  namespace: 'antman'
})

spinal.provide('listStock', function(data, res){
  console.log('from listStock methods', a, b)
  res.send(data)
})
