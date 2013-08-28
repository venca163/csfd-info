/*
 * Helper functions.
 */

var log = function log (msg) {
    console.log(msg);
}

var getNowSeconds = function getNowSeconds() {
    return Math.round(new Date().getTime()/1000);
}

module.exports.log = log;
module.exports.getNowSeconds = getNowSeconds;