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

    
    // cache interval: 3 hours
    this.cacheInterval = 10800;
    
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
        this._processRatings(this._userId);
    } else {
        this._error('type of request unknown');
    }
    
};

// PUBLIC API END
/////////////////////////////////////////////////////////////////////





CsfdInfo.prototype._processRatings = function (userId) {
    
    // Decide whether use cached data or get new one.
    this._useCacheOrApi(userId);
    
};

/*
 * Decide whether use cached data or get new one.
 */
CsfdInfo.prototype._useCacheOrApi = function (userId) {

    // get meta info from file
    var metaInfoData = fs.readFileSync(this._metaInfoPath, 'utf8');
    var metaInfo = JSON.parse(metaInfoData);

    var userInfo = metaInfo.metaInfo.ratings[userId];
    if (userInfo) {
        var now = getNowSeconds();
        
        // if data older than cache interval (set to 3 hours), 
        // dont use cache immediately, try to find if totalRatingsNum change first
        // if not, use cache...if changed, use API to get new data
        if ( (now - userInfo.lastReq) > this.cacheInterval) {

            var csfdInfo = this;
            $.ajax({
                url: this._getApiUserUrl + userId,
                crossDomain: true,
                contentType: 'application/json; charset=utf-8',
                timeout: 10000,
                success: function (ratingsData) {
                    // if: use API, values are different
                    if (ratingsData.total_ratings !== userInfo.lastRatingsNum) {
                        userInfo.lastReq = getNowSeconds();
                        userInfo.lastRatingsNum = ratingsData.total_ratings;
                        userInfo.reqCount++;
                        csfdInfo._updateMetaInfo(metaInfo);
                        
                        log('use API, second chance failed');
                        // get ratings from API, no cache
                        csfdInfo._getRatingsFromApi(userId);
                    } 
                    // else: use cache, ratings num did not changed since last time
                    else {
                        log('use cache second chance');
                        userInfo.reqCount++;
                        csfdInfo._updateMetaInfo(metaInfo);
                        
                        csfdInfo._useCache(userId);
                    }
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    log('error >> while getting data from API');
                    log(xhr.status);
                    log(ajaxOptions);
                    log(thrownError);
                    // retrieving totalRatingsNum failed
                    csfdInfo._getRatingsFromApi(userId);
                }
            });
        }
        // else data not too old - use cache, just update reqCount
        else {
            userInfo.reqCount++;
            this._updateMetaInfo(metaInfo);
            
            this._useCache(userId);
        }
    } 
    // first time request
    // store meta data for next time and dont use cache (there isnt one)
    else {
        var newUserInfo = {
            lastReq: getNowSeconds(),
            lastRatingsNum: -1,
            reqCount: 1
        };
        metaInfo.metaInfo.ratings[userId] = newUserInfo;
        this._updateMetaInfo(metaInfo);
        
        // get ratings from API, no cache
        this._getRatingsFromApi(userId);
    }
    
};

/*
 * Check if cache exist, if so use it.
 */
CsfdInfo.prototype._useCache = function (userId, apiFailFallback) {
    
    var dataExists = fs.existsSync(this._cacheRatingsPath + userId + '.json');
    if (dataExists) {
        this._getRatingsFromCache(userId);
    } 
    // fallback if cache retrieving fails
    else {
        if (apiFailFallback) {
            log('ERR >> API not reachable, no cache available. ' + userId);
            // everything failed
            this._processRatingsData([]);
        } else {
            console.log('ERR >> meta info exists, but cache file missing: ' + userId);
            this._getRatingsFromApi(userId);
        }
    }
}

/*
 *  Update meta info.
 */
CsfdInfo.prototype._updateMetaInfo = function (metaInfo) {
    
    var metaInfoToWrite = JSON.stringify(metaInfo);
    var fd = fs.openSync(this._metaInfoPath, 'w');
    var buf = new Buffer(metaInfoToWrite);
    fs.writeSync(fd, buf, 0, buf.length, 0);

}

/*
 * Asynchronously read data from csfdapi.cz.
 */
CsfdInfo.prototype._getRatingsFromApi = function (userId) {
    
    log('>> API ' + userId);
    var csfdInfo = this;
    $.ajax({
        url: this._getApiUserUrl + userId + '/ratings',
        crossDomain: true,
        contentType: 'application/json; charset=utf-8',
        timeout: 10000,
        success: function (ratingsData) {
            csfdInfo._saveRatingsToCache(userId, ratingsData);
            csfdInfo._processRatingsData(ratingsData);
        },
        error: function (xhr, ajaxOptions, thrownError) {
            log('error >> while getting data from API');
            log(xhr.status);
            log(ajaxOptions);
            log(thrownError);
            // retrieving from API failed, so try cache (if available)
            // but let useCache() you do not want to call API as fallback
            // (it could get into cyclus)
            csfdInfo._useCache(userId, 'noapi');
        }
    });
};

/*
 * 
 */
CsfdInfo.prototype._saveRatingsToCache = function (userId, ratings) {
    
    var ratingsToWrite = JSON.stringify(ratings);
    var fd = fs.openSync(this._cacheRatingsPath + userId + '.json', 'w');
    var buf = new Buffer(ratingsToWrite);
    fs.writeSync(fd, buf, 0, buf.length, 0);
};

/*
 * Asynchronously get data from cached file.
 */
CsfdInfo.prototype._getRatingsFromCache = function (userId) {
    
    log('>> cache ' + userId);
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

        ctx.font = 'bold italic 15pt Arial';
        ctx.fillStyle = 'white';
        ctx.fillText("CSFD ratings", 5, 30);
        

        ctx.fillStyle = '#111';
        var x = 125, y = 193, i;
        for (i=0; i<csfdInfo.ratings.distribution.length; i++) {
            ctx.font = 'bold 10pt Arial';
            ctx.fillText(csfdInfo.ratings.distribution[i], x, y);
            ctx.font = '10pt Arial';
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
var getNowSeconds = mod2.getNowSeconds; 




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