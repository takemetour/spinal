var Measured = require('measured')
var _ = require('lodash')

module.exports = function(broker){
  var metrics = Measured.createCollection()
  metrics.gauge('process.uptime', function() { return process.uptime() })
  metrics.gauge('process.mem', function() { return process.memoryUsage() })
  return metrics
}
