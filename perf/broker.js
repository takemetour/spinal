var Broker = require('../').Broker;
var broker = new Broker
broker.start(process.env.PORT, function(){
  console.log('Spinal:Broker listening...'+this.port)
});