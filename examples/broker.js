var Broker = require('../').Broker
var broker = new Broker({
  redis: 6379
})
broker.start(process.env.PORT || 7557, function(){
  console.log('Spinal:Broker listening...' + this.port)
})

// setTimeout(function(){
//   broker.stop()
// }, 7000)
