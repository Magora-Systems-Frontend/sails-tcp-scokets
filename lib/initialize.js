/**
 * Module dependencies
 */
var net = require('net'),
    http = require('http'),
    appRoot = process.env.PWD,
    socketMedium = require(appRoot + '/api/services/socketMedium.js'),
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
                  rotid = response.rotimatic_serial_number || response.result.rotimatic_serial_number,//check if exists
                  consoleId = response.QA_console_identifier || response.result.QA_console_identifier
                  startIndex = response.starting_index_number || response.result.starting_index_number
                  rotinum = response.number_of_rotimatics || response.result.number_of_rotimatics,
                  qaSessionRoti = response.serial_number || response.result.serial_number,
                  qaSessionNum = response.session_number || response.result.session_number;

              if(opcode){
                if(rotid){
                  connectObj.rotimaticId = rotid;
                  socket.rotimaticId = rotid;
                }
                if(logData){
                  connectObj.data = logData;
                }
                if(response.callback){
                  response.callback(connectObj, socket);
                  sails.io.emit(response.result.command, response.result);
                }
                if(consoleId){
                  connectObj.consoleId = consoleId;
                }
                if(startIndex && rotinum){
                  connectObj.startIndex = startIndex;
                  connectObj.rotinum = rotinum;
                }
                if(qaSessionNum && qaSessionRoti){
                  connectObj.qaSessionNum = qaSessionNum;
                  connectObj.qaSessionRoti = qaSessionRoti;
                }

              }
            
            }
          });

        });

        socket.on('error', function(err){
          socketDisconnect(err);          
        });

        socket.on('close', function(){
          socketDisconnect();          
        });

        socket.on('end', function(){
          socketDisconnect();          
        });


        function socketDisconnect(err){
          db.Session.findOne({sessionId: socket.id}, function(err, session){
            if(session){
              session.status = 1;
              session.endSession = new Date();
              
              session.save(function(err){
                if(err){
                   console.log('SESSION CLOSED WITH ERROR: ', err);
                }
                sails.io.emit('session', {message: 'Session closed.'});

                socketMedium.cleaner(socket.id);

                console.log('SESSION CLOSED WITH ERROR');
              });

              db.Rotimatic.findOne({serialNumber: session.rotimaticId}, function(err, rotimatic){
                if(rotimatic){ 
                  rotimatic.sessionStatus = 1;
                  rotimatic.save(function(err, roti){});
                }
              });
            }
            
          });
        }
  

      });

      sailsTcpServer.listen(sails.config.tcp.port);

      done();

    });

  };
};
