/*
 * Csfd info server.
 * 
 * using: express, jquery, fs
 */


var express = require('express');
var fs = require('fs');
//var $ = require('jquery');

var app = express();

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


    

    // forward to 'CsfdInfo' class
    // returns image as response (if possible)
    var mod1 = require('./CsfdInfo.js');
    var ci = new mod1.CsfdInfo(res, userId, type, version);
    ci.returnStatistics();
    
    
});


/* test page */
app.get('/index.html', function (req, res) {
    
    fs.readFile('index.html', function (err, html) {
        
        res.writeHeader(200, {"Content-Type": "text/html"});
        res.write(html);
        res.end();
    })
})

/* secret test page */
app.get('/crap!', function (req, res) {
    
    res.send("Yeah, its working.");
});


//////////////////////////////////////////////////////////////////////////
// app configuration 

// serving static files - in public directory
//app.configure(function(){
//    app.use(express.static(__dirname + '/public'));
//});

// listening on port
app.listen(2301);

console.log('App running on port 2301 ...');
console.log('Example - type in browser:');
console.log('serverurl:2301/?type=ratings&version=1&user=304220');

//////////////////////////////////////////////////////////////////////////
// custom functions
//var mod2 = require('./helper.js');
//var log = mod2.log; // get to each function like this? ugly!

