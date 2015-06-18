var Broker = require('../').Broker
var broker = new Broker()
broker.start(function(socket){
  console.log('Spinal:Broker listening...'+this.port)
})

// setTimeout(function(){
//   broker.stop()
// }, 7000)