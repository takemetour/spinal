var broker = require('../').Broker();
broker.start(function(socket){
  console.log('Spinal:Broker listening...'+socket.port)
});