var Broker = require('../').Broker
var broker = new Broker({redis: 6379})
broker.start(process.env.PORT, function(){
  console.log('Spinal:Broker listening...'+this.port)
})
