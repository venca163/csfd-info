/*
 * Main CsfdInfo class.
 * 
 */

// imports
var fs = require('fs');
var $ = require('jquery');


var CsfdInfo = function (res, userId, type, version) {

    /* save params */
    
    // node js response object
    this._res = res;
    // user id
    this._userId = userId;
    // type of response, for now just ratings
    this._type = type;
    // version
    this._version = version;

    
    // init ratings distribution to zero: 
    // crap!, *, **, ***, ****, *****
    this.ratings = {
        distribution: [0, 0, 0, 0, 0, 0],
        percentageDistribution: [0, 0, 0, 0, 0, 0],
        num: 0
    };

    
    
    /////////////////////////////////////////////////////////////
    // constants
    
    this._cacheImgPath = './public/images/cachedStatistics/';
    this._cacheImgExt = '.jpg';
    
    this._cacheRatingsPath = './public/data/cachedRatings/';
    
    this._ratingsImageBackgroundPath1 = './public/images/app/ratings_bg1.jpg';
    
    this._metaInfoPath = './appdata/metaInfo.json';
    
    // get API user url
    this._getApiUserUrl = 'http://csfdapi.cz/user/';
};


//////////////////////////////////////////////////////////////////////
// PUBLIC API START


/*
 * Initialize whole process of getting statistics and returning image as response.
 */
CsfdInfo.prototype.returnStatistics = function () {

//    console.log("It should be fine, just fine, fine.");
    
    // for now, just ratings
    if (this._type === 'ratings') {
        this._getSourceDataAndStartProcess(this._userId);
    } else {
        this._error('type of request unknown');
    }
    
};

// PUBLIC API END
/////////////////////////////////////////////////////////////////////




/*
 * Decide whether use cached data or get new one.
 */
CsfdInfo.prototype._getSourceDataAndStartProcess = function (userId) {
    
    var dataExists = fs.existsSync(this._cacheRatingsPath + userId + '.json');

    // TODO readme: always using cache in development
    if (dataExists && this._useCache(userId) ) {
        log('get ratings from cache');
        this._getRatingsFromCache(userId);
    }
    else {
        // TODO add - if server not responding, try to serve at least old cache file
        
        log('get ratings from api');
        this._getRatingsFromApi(userId);
    }
    
};

/*
 * Decide wether use cache or not.
 */
CsfdInfo.prototype._useCache = function (userId) {
    
    fs.readFile(this._metaInfoPath, 'utf8', function (err, metaInfoData) {
        
        var metaInfo = JSON.parse(metaInfoData).metaInfo;
    });
    
    return true;
};

/*
 * Asynchronously read data from csfdapi.cz.
 */
CsfdInfo.prototype._getRatingsFromApi = function (userId) {
    
    var csfdInfo = this;
    $.ajax({
        url: this._getApiUserUrl + userId + '/ratings',
        crossDomain: true,
        contentType: 'application/json; charset=utf-8',
        timeout: 10000,
        success: function (ratingsData) {
            csfdInfo._processRatingsData(ratingsData);
        },
        error: function (xhr, ajaxOptions, thrownError) {
            log(xhr.status);
            log(ajaxOptions);
            log(thrownError);
            csfdInfo._processRatingsData([]);
        }
    });
};

/*
 * Asynchronously get data from cached file.
 */
CsfdInfo.prototype._getRatingsFromCache = function (userId) {
    
    var csfdInfo = this;
    fs.readFile(this._cacheRatingsPath + userId + '.json', 'utf8', function (err, ratingsData) {
        
        if (err) {
            csfdInfo._processRatingsData([]);
        }
        csfdInfo._processRatingsData(JSON.parse(ratingsData));
    });
};


/*
 * Process data.
 * Count statistics, draw image, return response.
 */
CsfdInfo.prototype._processRatingsData = function (ratings) {
    
    // compute ratings
    this._countStatistics(ratings);
    // generate image and send it as response
    this._generateRatingsImage();

};


/*
 * Count all statistics.
 * For now, just count simple ratings distribution.
 */
CsfdInfo.prototype._countStatistics = function (ratings) {

    this._countRatings(ratings);
};


/*
 * Count ratings distribution.
 */
CsfdInfo.prototype._countRatings = function (ratings) {

    var csfdInfo = this;
    // number of all ratings 
    var ratingsNum = 0;

    // count distribution
    ratings.forEach(function (rating) {

        // 'missing "crap!" rating in csfdapi' workaround
        if (!rating.rating) {
            rating.rating = 0;
        }

        csfdInfo.ratings.distribution[rating.rating]++;
        ratingsNum++;
    });

    // count percentage distribution
    var i;
    for (i=0; i<this.ratings.distribution.length; i++) {
        this.ratings.percentageDistribution[i] = 
            Math.round(this.ratings.distribution[i] / ratingsNum * 100);
    }

    this.ratings.num = ratingsNum;
    
};



/*
 * Get data and write it into background image, then export to png and send as response.
 * Using canvas.
 */
CsfdInfo.prototype._generateRatingsImage = function () {

    // nothing yet
    var Canvas = require('canvas');

    var csfdInfo = this;
    var bgName = this._getRatingsImageBgName();
    fs.readFile(bgName, 'binary',  function (err, imgData) {
    
        if (err) {
            log(err);
            csfdInfo._error(err);
        }
        
        var img = new Canvas.Image();
        img.src = new Buffer(imgData, 'binary');

        var canvas = new Canvas(img.width, img.height);
        var ctx = canvas.getContext('2d');

        ctx.drawImage(img,0,0, img.width, img.height);

        ctx.font = 'bold italic 15pt Calibri';
        ctx.fillStyle = 'white';
        ctx.fillText("ČSFD ratings", 5, 30);
        

        ctx.fillStyle = '#111';
        var x = 125, y = 193, i;
        for (i=0; i<csfdInfo.ratings.distribution.length; i++) {
            ctx.font = 'bold 10pt Calibri';
            ctx.fillText(csfdInfo.ratings.distribution[i], x, y);
            ctx.font = '10pt Calibri';
            ctx.fillText('(' + csfdInfo.ratings.percentageDistribution[i] + '%)', x+35, y);
            y -= 25;
        }
        

        var imgPngString = canvas.toDataURL('image/png');

        csfdInfo._sendRatingsImageAsResponse(imgPngString);

    });

};

/*
 * Pick up one of bg images.
 */
CsfdInfo.prototype._getRatingsImageBgName = function () {
    
    switch (this._version) {
        case 1: 
            return this._ratingsImageBackgroundPath1;
        default: 
            return this._ratingsImageBackgroundPath1;
    }
};


/*
 * Finally send response.
 */
CsfdInfo.prototype._sendRatingsImageAsResponse = function (img) {
    
    log(this.ratings.distribution);
    log(this.ratings.percentageDistribution);
    log(this.ratings.num);
    
    // convert to real PNG image.
    var data = img.replace(/^data:image\/\w+;base64,/, "");
    var bufImage = new Buffer(data, 'base64');
    
    this._res.writeHead(200, {
        'Content-Type': 'image/png'
    });
    this._res.end(bufImage, 'binary');
    
};


/*
 *  Throw error.
 */
CsfdInfo.prototype._error = function (msg) {
    
    this._res.end('ERROR >>> ' + msg);
};

////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////

module.exports.CsfdInfo = CsfdInfo;


//////////////////////////////////////////////////////////////////////////
// custom functions
var mod2 = require('./helper.js');
var log = mod2.log; // take each function like this? ugly!




// TODO
// - osetrit pripady, kdy se nepodari dostat data z api
//   - nejdriv zkusit cache, pak teda vratit chybovy obrazek

// backup
//    $.get("http://localhost/csfd_info/data/ratings/ratings_" + id + ".json", function (ratings) {
//                $.get("http://localhost/csfd_info/data/ratings/ratings_" + id + " - 2.json", function (ratings) {
//
//        csfdInfo._countStatistics(ratings);
//                    log(dataJson);
//
//    });