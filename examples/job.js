var Spinal = require('../').Node
var _ = require('lodash')

var spinal = new Spinal('spinal://127.0.0.1:7557', {namespace: 'a'})
spinal.provide('check', function(arg, res){
  setTimeout(function(){res.send(arg)}, 1000)
})

spinal.start(function(){
  console.log(spinal.namespace + ' ... started')
  var j = 1
  setInterval(function(){
    spinal.job('send', {title: 'test '+j, a: j}).save(function(err, id){
      j++
    })
  }, 300)
})
