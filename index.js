const async = require('async')
const request = require('request')
const cheerio = require('cheerio')
const FB = require('fb')
const fs = require('fs');

const fbAppId = '671144643027916';
const fbAppSecret = 'ca1c207a2fd4c4a8481241a50d2a24db';

const baseUrl = 'http://allevents.in/ho%20chi%20minh%20city/all'

function main() {
    //Get events from allevents.in
    //getAllEventsMetaData()

    getAllFbEventData();
};

var getAllEventsMetaData = function() {
    var data = [];
    var isEnd = false;
    var options = {
        method: 'POST',
        json: true,
        uri: 'https://api.allevents.in/events/list',
        headers: {
            'Ocp-Apim-Subscription-Key': 'df79192b82f34404a51106f15ffee8df'
        },
        qs: {
            city: 'Ho Chi Minh City',
            state: 'HC',
            country: 'Vietnam',
            page: 0
        }
    }

    async.doWhilst(
        function getData(callback) {
            request(options, function (err, res, body) {
                if (err) {
                    return callback(err)
                };

                if (res.statusCode == 200) {
                    if (body.error == 0 || body.data.length != 0) {
                        data = data.concat(body.data);

                        console.log('Get ' + data.length + ' events.')
                    };

                    if (body.error == 1) {
                        console.log(body);
                        isEnd = true;
                    };

                    options.qs.page++;

                    return callback();
                } else {
                    return callback(new Error(res.statusCode));
                }
            })
        }, function loopCondition() {
            return !isEnd;
        }, function handler(err) {
            if (err) {
                console.log(err);
            };

            fs.writeFileSync('./events.js', JSON.stringify(data, null, 4));
            console.log('Done');
        })
}

var getFbAccessToken = function (appId, appSecret, callback) {
    FB.api('oauth/access_token', {
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'client_credentials'
    }, function (res) {
        if(!res || res.error) {
            return callback(res.error);
        }

        var accessToken = res.access_token;
        return callback(null, accessToken)
    });
}

var getAllFbEventData = function() {
    var data = fs.readFileSync('./events.js', 'utf8');
    data = JSON.parse(data);

    getFbAccessToken(fbAppId, fbAppSecret, function (err, accessToken) {
        FB.setAccessToken(accessToken);
        var events = [];

        async.eachLimit(data, 2, function (eventMetaData, callback) {
            getFbEventData(eventMetaData.event_id, function (err, e) {
                if (err) {
                    console.log(err);
                    return callback();
                };

                console.log('Collected data of event: ' + e.id);

                events.push(e);
                return callback();
            })
        }, function (err) {
            if (err) {
                console.log(err);
            };

            var finalData = {
                count: events.length,
                data: events
            }

            fs.writeFileSync('fb-events.js', JSON.stringify(finalData, null, 4));
            console.log('done');
            return;
        })
    });
}

var getFbEventData = function (eventId, callback) {
    var e;

    async.parallel([
        function (callback) {
            getFbEventInfo(eventId, function (err, eventInfo) {
                if (err) {
                    return callback(err);
                };

                return callback(null, eventInfo);
            })
        }, function (callback) {
            getFbEventAttending(eventId, function (err, eventAttending) {
                if (err) {
                    return callback(err);
                };

                return callback(null, eventAttending);
            })
        }, function (callback) {
            getFbEventDeclined(eventId, function (err, eventDeclined) {
                if (err) {
                    return callback(err);
                };

                return callback(null, eventDeclined);
            })

        }], function (err, results) {
            if (err) {
                return callback(err);
            };

            e = results[0];
            e.attending = results[1];
            e.declined = results[2];

            return callback(null, e);
        })
}

var getFbEventInfo = function (eventId, callback) {
    FB.api(eventId, function (res) {
        if(!res || res.error) {
           return callback(res.error);
        }

        return callback(null, res)
    })
}

var getFbEventAttending = function (eventId, callback) {
    getFbDataWithPages(eventId + '/attending', function (err, attending) {
        return callback(err, attending);
    })
}

var getFbEventDeclined = function (eventId, callback) {
    getFbDataWithPages(eventId + '/declined', function (err, attending) {
        return callback(err, attending);
    })
}

var getFbDataWithPages = function (url, callback) {
    var parameters = {}
    var r;
    var isEnd = false;

    async.doWhilst(function (callback) {
        FB.api(url, parameters, function (res) {
            if(!res || res.error) {
               return callback(res.error);
            }

            if(!res.paging || !res.paging.next) {
                isEnd = true;
            } else {
                parameters.after = res.paging.cursors.after
            }

            if (r == undefined) {
                r = res;
            } else {
                r.data = r.data.concat(res.data)
            }

            return callback()
        })
    }, function () {
        return !isEnd;
    }, function (err) {
        if (err) {
            return callback(err);
        };

        return callback(null, r);
    })
}

main()