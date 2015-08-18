/**
 * Module dependencies
 */
var net = require('net'),
    http = require('http'),
    appRoot = process.cwd(),
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
              socketId = ip.split('.').join('') + port + salt;
   
          socket.id = socketId;
          socket.ip = ip;
          socket.port = port;

          console.log('CLIENT PORT: ', port);

          protocol.decode(hex, function(response){

            if(response && response.hasOwnProperty('result') && response.result.command){
              console.log('COMMAND: ', response.result.command);
            }

            if(response !== 'Unknown first byte'){
              var logData = response.data || response.result.data,
                  packetsNum = response.number_of_packets_contained_in_frame || response.result.number_of_packets_contained_in_frame,
                  dataLength = response.data_length || response.result.data_length,
                  opcode = response.opcode || response.result.opcode,
                  rotid = response.rotimatic_serial_number || response.result.rotimatic_serial_number,//check if exists
                  consoleId = response.QA_console_identifier || response.result.QA_console_identifier,
                  startIndex = response.starting_index_number || response.result.starting_index_number,
                  rotinum = response.number_of_rotimatics || response.result.number_of_rotimatics,
                  qaSessionRoti = response.serial_number || response.result.serial_number,
                  qaSessionNum = response.session_number || response.result.session_number;

              if(opcode){

                if(rotid){
                  socket.rotimaticId = rotid;
                }

                if(packetsNum){
                  socket.packetsNum = packetsNum;
                  socket.dataLength = dataLength;
                }

                socket.data = logData;
                socket.qaIdentifier = consoleId;
                socket.startIndex = startIndex;
                socket.rotinum = rotinum;
                socket.qaSessionNum = qaSessionNum;
                socket.qaSessionRoti = qaSessionRoti;
    
                if(response.callback){
                  response.callback(socket);
                  sails.io.emit(response.result.command, response.result);
                }


              }
            
            }
          });

        });

        socket.on('close', function(err){
          socketMedium.rTrigger('end' +  socket.id, socket);
          socketMedium.disconnect(['session', 'settings', 'end'], socket.id);          
        });

        socket.on('error', function(err){
          console.log('SOCKET ERROR: ', err);
          /*socketMedium.rTrigger('end' +  socket.id, socket);
          socketMedium.disconnect(['session', 'settings', 'end'], socket.id);*/          
        });
  

      });

      sailsTcpServer.listen(sails.config.tcp.port);

      done();

    });

  };
};
