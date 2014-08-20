/*
 * Csfd info server.
 * 
 * using: express, jquery, fs, canvas
 */


var express = require('express');
var fs = require('fs');
//var $ = require('jquery');
var CsfdInfoModule = require('./app/classes/CsfdInfo.js');

var app = express();

// forward to 'CsfdInfo' class
// returns image as response (if possible)
//var mod1 = require('./app/classes/CsfdInfo.js');
//var ci = new mod1.CsfdInfo(null, 304220, "ratings", 1);
//ci.returnStatistics();

//app.get('/', function (req, res) {
//    console.log("///////////////////////////");
//    console.log(req.url);
//    console.log("///////////////////////////");
////    res.end("end");
//});

app.get('/', function(req, res) {
    
    // get params from URL
    var userId = req.query.user;
    var type = req.query.type;
    var version = req.query.version;
    
    if (!userId) {
        res.send('>>> no user id');
    }
    // default type
    if (!type) {
        type = "ratings";
    }
    // default version
    if (!version) {
        version = 1;
    }
    
    console.log("********************");
    console.log(req.url);

    // forward to 'CsfdInfo' class
    // returns image as response (if possible)
    var ci = new CsfdInfoModule.CsfdInfo(res, userId, type, version);
    ci.returnStatistics();
});


/* test page */
app.get('/index.html', function (req, res) {
    
    fs.readFile('index.html', function (err, html) {
        
        res.writeHeader(200, {"Content-Type": "text/html"});
        res.write(html);
        res.end();
    });
});

/* secret test page */
app.get('/crap!', function (req, res) {
    
    res.send("Yeah, its working.");
});


//////////////////////////////////////////////////////////////////////////
// app configuration 

// serving static files - in public directory
app.configure(function(){
    app.use(express.static(__dirname + '/public'));
    app.use(express.static(__dirname + '/appdata'));
});

var port = process.env.PORT || 2301;
// listening on port
app.listen(port);

console.log('App running on port 2301 ...');
console.log('Example usage - type in browser:');
console.log('serverurl:2301/?type=ratings&version=1&user=304220');

//////////////////////////////////////////////////////////////////////////
// custom functions
//var mod2 = require('./helper.js');
//var log = mod2.log; // get to each function like this? ugly!

