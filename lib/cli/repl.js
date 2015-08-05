var REPL = require('repl')
var vm = require('vm')

var defaults = {
  prompt: 'spinal> ',
  eval: function(input, context, filename, cb){
    try {
      cb(null, eval(input))
    } catch (err) {
      return cb(err)
    }
  }
}

var repl = REPL.start(defaults)
repl.on('exit', function(){
  return repl.outputStream.write('\n')
})
