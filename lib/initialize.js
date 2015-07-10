/**
 * Module dependencies
 */
var net = require('net'),
    http = require('http'),
    StringDecoder = require('string_decoder').StringDecoder,
    crypto = require('crypto');


/**
 * @param  {Sails} app
 * @return {Function}     [initialize]
 */
module.exports = function ToInitialize(app) {

  /**
   * This function is triggered when the hook is loaded.
   *
   * @param  {Function} done
   */

  return function initialize (done) {


    (function waitForOtherHooks(next){

      if (!app.hooks.http) {
        return next(console.log('Cannot use `sockets` hook without the `http` hook.'));
      }

      // If http hook is enabled, wait until the http hook is loaded
      // before trying to attach the socket.io server to our underlying
      // HTTP server.
      app.after('hook:http:loaded', function (){

        // Session hook is optional.
        if (app.hooks.session) {
          return app.after('hook:session:loaded', next);
        }
        return next();
      });
    })(function whenReady (err){
      if (err) return done(err);

      app.log.verbose('Preparing TCP...');

      // Get access to the http server instance in Sails
      //var sailsHttpServer = app.hooks.http.server;

      var sailsTcpServer = net.createServer(function (socket) {

        var salt = crypto.randomBytes(7).toString('hex');

        socket.on('data', function(chunk) {
          var ip = socket.remoteAddress,
              port = socket.remotePort,
              hex = chunk.toString('hex'),
              socketId = ip.split('.').join('') + port + salt,
              connectObj = {
                socketId: socketId,
                ip: ip,
                port: port
              };
              
          socket.id = socketId;
          
          console.log('CLIENT PORT: ', port);

          protocol.decode(hex, function(response){

            if(response && response.hasOwnProperty('result') && response.result.command){
              console.log('COMMAND: ', response.result.command);
            }

            if(response !== 'Unknown first byte'){
              var logData = response.data || response.result.data;
                  opcode = response.opcode || response.result.opcode,
                  rotid = response.rotimatic_serial_number || response.result.rotimatic_serial_number;//check if exists

              if(opcode){
                if(rotid){
                  connectObj.rotimaticId = rotid;
                }
                if(logData){
                  connectObj.data = logData;
                }
                if(response.callback){
                  response.callback(connectObj, socket);
                }

              }
            
            }
          });

        });

        socket.on('error', function(err){
          db.Session.findOne({sessionId: socket.id, status: {$ne: 1}}, function(session){
            if(session){
              session.status = 1;
              session.endSession = new Date();
              
              session.save(function(err){
                if(err){
                   console.log('SESSION CLOSED WITH ERROR: ', err);
                }
                console.log('SESSION CLOSED WITH ERROR');
              });
            }
            
          });
          console.log('CLIENT CLOSED CONNECTION: ', err);
        });
  

      });

      sailsTcpServer.listen(sails.config.tcp.port);

      done();

    });

  };
};
