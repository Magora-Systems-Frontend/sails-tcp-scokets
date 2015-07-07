/**
 * `sockets` hook
 */

module.exports = function (app){

  return {

    initialize: require('./lib/initialize')(app)

  };
};





