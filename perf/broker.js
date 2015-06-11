var broker = require('../').Broker();
broker.start(process.env.PORT, function(socket){
  console.log('Spinal:Broker listening...'+socket.port)
});