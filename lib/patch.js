var rpc = require('pm2-axon-rpc')
  , axon = require('pm2-axon')
  , debug = require('debug')('axon:x')
  , Stringify = require('json-stringify-safe')
  , Message = require('amp-message')
  , slice = require('pm2-axon/lib/utils').slice;

Object.isEmpty = function(obj){
  return Object.keys(obj).length === 0 && obj.constructor === Object
}

/* istanbul ignore next */
axon.RepSocket.prototype.onmessage = function(sock){
  var self = this;

  return function (buf){
    var msg = new Message(buf);
    var args = msg.args;

    var id = args.pop();
    args.unshift('message');
    args.push(reply);
    args.push(sock);
    self.emit.apply(self, args);

    function reply() {
      var fn = function(){};
      var args = slice(arguments);
      args[0] = args[0] || null;

      var hasCallback = 'function' == typeof args[args.length - 1];
      if (hasCallback) fn = args.pop();

      args.push(id);

      if (sock.writable) {
        sock.write(self.pack(args), function(){ fn(true) });
        return true;
      } else {
        debug('peer went away');
        process.nextTick(function(){ fn(false) });
        return false;
      }
    }
  };
};

/* istanbul ignore next */
rpc.Server.prototype.onmessage = function(msg, reply, sock){
  if ('methods' == msg.type) return this.respondWithMethods(reply);

  if (!reply) {
    console.error('reply false');
    return false;
  }
  // .method
  var meth = msg.method;
  if (!meth) return reply({ error: '.method required' });

  // ensure .method is exposed
  var fn = this.methods[meth];
  if (!fn) return reply({ error: 'method "' + meth + '" does not exist' });

  // .args
  var args = msg.args;
  if (!args) return reply({ error: '.args required' });

  // invoke
  args.push(function(err){
    if (err) return reply({ error: err.message, stack: err.stack });
    var args = [].slice.call(arguments, 1);

    args.forEach(function(arg, i) {
      if(typeof arg === 'undefined') arg = null
      args[i] = JSON.parse(Stringify(arg));
    });

    reply({ args: args });
  });
  args.push(sock)

  fn.apply(null, args);
};
