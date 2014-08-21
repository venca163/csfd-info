/*
 * Main CsfdInfo class.
 * 
 */

// imports
var fs = require('fs');
var $ = require('jquery');
var pgdb = require('./PostgresDB.js');

var CsfdInfo = function (res, userId, type, version) {

    // node js response object
    this._res = res;
    // user id
    this._userId = userId;
    // type of response, for now just ratings
    this._type = type;
    // version
    this._version = version;
    // prepare DB
    this._db = new pgdb.PostgresDB();

    // init ratings distribution to zero: 
    // crap!, *, **, ***, ****, *****
    this.ratings = {
        distribution: [0, 0, 0, 0, 0, 0],
        percentageDistribution: [0, 0, 0, 0, 0, 0],
        num: 0
    };
    
    // cache interval: 3 hours
    this.cacheInterval = 10800;
};


/////////////////////////////////////////////////////////////
// constants
CsfdInfo._CACHE_RATINGS_PATH = './public/data/cachedRatings/';
CsfdInfo._RATINGS_IMG_BG_PATH_1 = './public/images/app/ratings_bg1.png';
CsfdInfo._RATINGS_IMG_BG_PATH_2 = './public/images/app/ratings_bg2.png';
CsfdInfo._CSFD_API_USER_URL = 'http://csfdapi.cz/user/';
//
/////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////
// PUBLIC API START

/*
 * Initialize whole process of getting statistics and returning image as response.
 */
CsfdInfo.prototype.returnStatistics = function () {
   
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
CsfdInfo.prototype._useCacheOrApi = function (csfdId) {
    
    var csfdInfo = this;
    // try to read user from DB
    this._db.getUser(csfdId, function(users) {
        // if: no data available
        if (users.length === 0) {
            csfdInfo._storeNewUser(csfdId);
            // get ratings from API, no cache
            csfdInfo._getRatingsFromApi({csfdid: csfdId});
        } 
        // else: user data available
        else {
            console.log(">> DATA AVAILABLE");
            var user = users[0]; // if more users (impossible), take the first one
            var now = getNowSeconds();
            // if: data older than cache interval (3 hours), 
            if ( (now - user.lastreq) > csfdInfo.cacheInterval) {
                // try to find if totalRatingsNum has changed
                $.ajax({
                    url: CsfdInfo._CSFD_API_USER_URL + csfdId,
                    crossDomain: true,
                    contentType: 'application/json; charset=utf-8',
                    timeout: 10000,
                    success: function (ratingsData) {
                        // if: use API, values are different
                        if (ratingsData.total_ratings !== user.lastratingsnum) {
                            console.log(">> NUMBER OF RATINGS HAS CHANGED -> USE API");
                            // update user
                            user.lastreq = now;
                            user.lastratingsnum = ratingsData.total_ratings;
                            csfdInfo._updateUser(user);
                            // get ratings from API, no cache
                            csfdInfo._getRatingsFromApi(user);
                        } 
                        // else: use cache, number of ratings did not changed since last time
                        else {
                            console.log(">> NUMBER OF RATINGS THE SAME -> USE CACHE");
                            // update user
                            user.lastreq = now;
                            csfdInfo._updateUser(user);
                            // user cache
                            csfdInfo._useCache(user);
                        }
                    },
                    error: function (xhr, ajaxOptions, thrownError) {
                        console.error("ERROR: while getting user total ratings from API");
                        console.log(xhr.status);
                        console.log(ajaxOptions);
                        console.log(thrownError);
                        // retrieving totalRatingsNum failed
                        csfdInfo._getRatingsFromApi(user);
                    }
                });
            }
            // else: data not older than cache interval (3 hours)
            else {
                console.log(">> DATA FRESH");
                csfdInfo._updateUser(user);
                csfdInfo._useCache(user);
            }
        }
    });
};


/*
 * Check if cache exist, if so use it.
 */
CsfdInfo.prototype._useCache = function (user, apiFailed) {
    
    var apiFailed = apiFailed || false;
    if (user.ratings && user.lastreq && user.lastratingsnum && user.reqcount) {
        this._processRatingsData(user.ratings);
    }
    // else if: some data corrupted -> use API
    else if (!apiFailed) {
        this._getRatingsFromApi(user);
    }
    // else: API did not answer (probably temporaly shut down)
    else {
        // no use crying over spilt milk, everything has failed, show image with no data
        this._processRatingsData([]);
    }
};


/*
 * Asynchronously read data from csfdapi.cz.
 */
CsfdInfo.prototype._getRatingsFromApi = function (user) {
    console.log(">> GET RATINGS FROM API");
    var csfdInfo = this;
    $.ajax({
        url: CsfdInfo._CSFD_API_USER_URL + user.csfdid + '/ratings',
        crossDomain: true,
        contentType: 'application/json; charset=utf-8',
        timeout: 40000,
        success: function (ratingsData) {
            user.lastreq = getNowSeconds();
            user.lastratingsnum = ratingsData.length;
            user.reqcount = user.reqcount || 0;
            user.ratings = ratingsData;
            csfdInfo._updateUser(user);
            csfdInfo._processRatingsData(ratingsData);
        },
        error: function (xhr, ajaxOptions, thrownError) {
            console.log('ERROR: while getting ratings from API');
            console.log(xhr.status);
            console.log(ajaxOptions);
            console.log(thrownError);
            // retrieving from API failed, so try cache (if available)
            csfdInfo._useCache(user, true);
        }
    });
};

/*
 * Store new user to DB, without ratings.
 */
CsfdInfo.prototype._storeNewUser = function (userId) {
    
    this._db.storeUser(userId, getNowSeconds(), 0, 1);
};

/*
 * Update existing user in DB, ratings included.
 */
CsfdInfo.prototype._updateUser = function (user) {
    
    this._db.updateUser(user.csfdid, user.lastreq, user.lastratingsnum, ++user.reqcount, user.ratings);
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
    var diffArray = [];
    var percentageCount = 0, realValue, roundedValue, diffValue;
    for (var i=0; i<this.ratings.distribution.length; i++) {
        realValue = this.ratings.distribution[i] / ratingsNum * 100;
        roundedValue = Math.round(realValue);
        diffValue = realValue - roundedValue;
        diffArray.push({id: i, val:diffValue});
        this.ratings.percentageDistribution[i] = roundedValue;
        percentageCount += roundedValue;
    }
    
    console.log(this.ratings.percentageDistribution);
    console.log(diffArray);
    var x;
    var diff = percentageCount-100;
    diffArray.sort(getSortNumericFunction());
    if (diff > 0) {
        for (var i = 0; i < diffArray.length;i++) {
            x = diffArray[i];
            if (x.val < 0) {
                this.ratings.percentageDistribution[x.id]--;
                diff--;
                if (diff === 0) break;
            }
        }        
    } else if (diff < 0) {
        for (var i = diffArray.length-1; i >= 0; i--) {
            x = diffArray[i];
            if (x.val > 0) {
                this.ratings.percentageDistribution[x.id]++;
                diff++;
                if (diff === 0) break;
            }
        }
    }
    console.log(this.ratings.percentageDistribution);
    this.ratings.num = ratingsNum;
};


/*
 * Get data and write it into background image, then export to png and send as response.
 * Using canvas.
 */
CsfdInfo.prototype._generateRatingsImage = function () {
    
    var Canvas = require('canvas');
    var csfdInfo = this;
    var bgName = this._getRatingsImageBgName();
    fs.readFile(bgName, 'binary',  function (err, imgData) {
        if (err) {
            console.log(err);
            csfdInfo._error(err);
        }
        var img = new Canvas.Image();
        img.src = new Buffer(imgData, 'binary');
        var canvas = new Canvas(img.width, img.height);
        var ctx = canvas.getContext('2d');
        
        var font = csfdInfo._getFont();

        ctx.drawImage(img,0,0, img.width, img.height);

        ctx.fillStyle = '#111';
        var x = 125, y = 193;
        for (var i=0; i<csfdInfo.ratings.distribution.length; i++) {
            ctx.font = 'bold 10pt ' + font;
            ctx.fillText(csfdInfo.ratings.distribution[i], x, y);
            ctx.font = '10pt ' + font;
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
            return CsfdInfo._RATINGS_IMG_BG_PATH_1;
        case 2:
            return CsfdInfo._RATINGS_IMG_BG_PATH_2;
        default: 
            return CsfdInfo._RATINGS_IMG_BG_PATH_1;
    }
};

/*
 * Pick up font for version. 
 */
CsfdInfo.prototype._getFont = function () {
    
    switch(this._version) {
        case 1:
            return "Helvetica";
        case 2:
            return "Courier New";
        default:
            return "Arial";
    }
}


/*
 * Finally send response.
 */
CsfdInfo.prototype._sendRatingsImageAsResponse = function (img) {
    
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

var mod2 = require('../../helper.js');
var getNowSeconds = mod2.getNowSeconds; 
var getSortNumericFunction = mod2.getSortNumericFunction;
