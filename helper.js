/*
 * Helper functions.
 */

var getNowSeconds = function getNowSeconds() {
    return Math.round(new Date().getTime()/1000);
};

var getSortNumericFunction = function() {
    return function(a, b) {
        return a.val-b.val;
    };
};

module.exports.getNowSeconds = getNowSeconds;
module.exports.getSortNumericFunction = getSortNumericFunction;
