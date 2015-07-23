var Spinal = require('../').Node
var _ = require('lodash')

var spinal = new Spinal('spinal://127.0.0.1:5001,127.0.0.1:5002', {namespace: 'nock'})
spinal.provide('check', function(arg, res){
  res.send(arg)
})
spinal.start(function(){
  console.log(spinal.namespace + ' ... started')

  spinal.nock(__dirname + '/../tmp')
  spinal.nock.rec()
  // spinal.nock.start()
  // spinal.nock.start({strict: false})

  spinal.call('check', {d:1}, function(err, data){
    console.log('check result', data)
    process.exit()
  })

})
