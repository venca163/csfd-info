
//var pgdb = require('../database/PostgresDB.json');
var pg = require('pg');

var PostgresDB = function () {
    
//    this.connectionString = process.env.DATABASE_URL || pgdb.connectionString;
    this.connectionString = process.env.DATABASE_URL;
    this.connected = false;
    
    this.connect();
};

PostgresDB.client = null;

PostgresDB.prototype.connect = function () {
    if (PostgresDB.client === null) {
        PostgresDB.client = new pg.Client(this.connectionString);
        PostgresDB.client.connect(function (err) {
           if (err) {
               console.error('error running query', err);
           } else {
               console.log('>> Postgres DB connected');
               this.connected = true;
           }
        });
    }
};


PostgresDB.prototype.getUser = function (csfdId, onSuccess) {
    var client = PostgresDB.client;
    var q = client.query("SELECT * FROM CsfdUser WHERE csfdId = $1", [csfdId]);
    q.on("row", function(row, result) {
        result.addRow(row)
    });
    q.on("end", function(result) {
        onSuccess(result.rows);
    });
};


PostgresDB.prototype.storeUser = function (csfdId, lastReq, lastRatingsNum, reqCount) {
    var client = PostgresDB.client;
    client.query(
            "INSERT INTO CsfdUser (csfdId, lastReq, lastRatingsNum, reqCount)" +
            "VALUES ($1, $2, $3, $4)",
            [csfdId, lastReq, lastRatingsNum, reqCount]
    );
};

PostgresDB.prototype.updateUser = function (csfdId, lastReq, lastRatingsNum, reqCount, ratings) {
    console.log(">> DB: updating user");
    console.log([csfdId, lastReq, lastRatingsNum, reqCount]);
    var client = PostgresDB.client;
    client.query(
            "UPDATE CsfdUser SET lastReq = ($2), lastRatingsNum = ($3), reqCount = ($4), ratings = ($5) " +
            "WHERE csfdId = ($1)",
            [csfdId, lastReq, lastRatingsNum, reqCount, JSON.stringify(ratings)]
            );
            
};

module.exports.PostgresDB = PostgresDB;

