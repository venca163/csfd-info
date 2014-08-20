/*
 * Helper functions.
 */

var getNowSeconds = function getNowSeconds() {
    return Math.round(new Date().getTime()/1000);
}

module.exports.getNowSeconds = getNowSeconds;