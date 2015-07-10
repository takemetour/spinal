var Spinal = require('../').Node
var _ = require('lodash')

var spinal = new Spinal('spinal://127.0.0.1:7557', {namespace: 'email'})
spinal.provide('check', function(arg, res){
  setTimeout(function(){res.send(arg)}, 1000)
})
spinal.worker('send', function(arg, res){
  setTimeout(function(){
    console.log('send', arg)
    res.log(1)
    res.log(2)
    res.log(3)
    // if(arg.a % 4 == 0)
    //   res.error('sometime')
    // else
      res.send(arg)
  }, 1000)
})
spinal.start(function(){
  console.log(spinal.namespace + ' ... started')
  // setInterval(function(){
  //   spinal.call('check', function(){ console.log('.') })
  // }, 1000)
})
