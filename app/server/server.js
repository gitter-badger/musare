Meteor.startup(function() {
    reCAPTCHA.config({
        privatekey: '6LcVxg0TAAAAAI2fgIEEWHFxwNXeVIs8mzq5cfRM'
    });
    var stations = [{tag: "edm", display: "EDM"}, {tag: "pop", display: "Pop"}]; //Rooms to be set on server startup
    for(var i in stations){
        if(Rooms.find({type: stations[i]}).count() === 0){
            createRoom(stations[i].display, stations[i].tag);
        }
    }
});

var stations = [];

var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_";
function createUniqueSongId() {
    var code = "";
    for (var i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    if (Playlists.find({"songs.mid": code}).count() > 0) {
        return createUniqueSongId();
    } else {
        return code;
    }
}

function getStation(type, cb) {
    stations.forEach(function(station) {
        if (station.type === type) {
            cb(station);
            return;
        }
    });
}

function createRoom(display, tag) {
    var type = tag;
    if (Rooms.find({type: type}).count() === 0) {
        Rooms.insert({display: display, type: type}, function(err) {
            if (err) {
                throw err;
            } else {
                if (Playlists.find({type: type}).count() === 1) {
                    stations.push(new Station(type));
                } else {
                    Playlists.insert({type: type, songs: getSongsByType(type)}, function (err2) {
                        if (err2) {
                            throw err2;
                        } else {
                            stations.push(new Station(type));
                        }
                    });
                }
            }
        });
    } else {
        return "Room already exists";
    }
}

function Station(type) {
    var _this = this;
    var startedAt = Date.now();
    var playlist = Playlists.findOne({type: type});
    var songs = playlist.songs;

    if (playlist.lastSong === undefined) {
        Playlists.update({type: type}, {$set: {lastSong: 0}});
        playlist = Playlists.findOne({type: type});
        songs = playlist.songs;
    }
    var currentSong = playlist.lastSong;
    if (currentSong < (songs.length - 1)) {
        currentSong++;
    } else currentSong = 0;
    var currentTitle = songs[currentSong].title;

    Rooms.update({type: type}, {$set: {currentSong: {song: songs[currentSong], started: startedAt}}});

    this.skipSong = function() {
        songs = Playlists.findOne({type: type}).songs;
        songs.forEach(function(song, index) {
            if (song.title === currentTitle) {
                currentSong = index;
            }
        });
        if (currentSong < (songs.length - 1)) {
            currentSong++;
        } else currentSong = 0;
        if (songs);
        if (currentSong === 0) {
            this.shufflePlaylist();
        } else {
            if (songs[currentSong].mid === undefined) {
                var newSong = songs[currentSong];
                newSong.mid = createUniqueSongId();
                songs[currentSong].mid = newSong.mid;
                Playlists.update({type: type, "songs": songs[currentSong]}, {$set: {"songs.$": newSong}});
            }
            if (songs[currentSong].likes === undefined) {
                var newSong = songs[currentSong];
                newSong.likes = 0;
                Playlists.update({type: type, "songs": newSong}, {$set: {"songs.$": newSong}});
            }
            if (songs[currentSong].dislikes === undefined) {
                var newSong = songs[currentSong];
                newSong.dislikes = 0;
                Playlists.update({type: type, "songs": newSong}, {$set: {"songs.$": newSong}});
            }
            currentTitle = songs[currentSong].title;
            Playlists.update({type: type}, {$set: {lastSong: currentSong}});
            Rooms.update({type: type}, {$set: {timePaused: 0}});
            this.songTimer();
            Rooms.update({type: type}, {$set: {currentSong: {song: songs[currentSong], started: startedAt}}});
        }
    };

    this.shufflePlaylist = function() {
        songs = Playlists.findOne({type: type}).songs;
        currentSong = 0;
        Playlists.update({type: type}, {$set: {"songs": []}});
        songs = shuffle(songs);
        songs.forEach(function(song) {
            if (song.mid === undefined) {
                song.mid = createUniqueSongId();
            }
            if (song.likes === undefined) {
                song.likes = 0;
            }
            if (song.dislikes === undefined) {
                song.dislikes = 0;
            }
            Playlists.update({type: type}, {$push: {"songs": song}});
        });
        currentTitle = songs[currentSong].title;
        Playlists.update({type: type}, {$set: {lastSong: currentSong}});
        Rooms.update({type: type}, {$set: {timePaused: 0}});
        this.songTimer();
        Rooms.update({type: type}, {$set: {currentSong: {song: songs[currentSong], started: startedAt}}});
    };

    Rooms.update({type: type}, {$set: {timePaused: 0}});

    var timer;

    this.songTimer = function() {
        startedAt = Date.now();

        if (timer !== undefined) {
            timer.pause();
        }
        timer = new Timer(function() {
            _this.skipSong();
        }, songs[currentSong].duration * 1000);
    };

    var state = Rooms.findOne({type: type}).state;

    this.pauseRoom = function() {
        if (state !== "paused") {
            timer.pause();
            Rooms.update({type: type}, {$set: {state: "paused"}});
            state = "paused";
        }
    };
    this.resumeRoom = function() {
        if (state !== "playing") {
            timer.resume();
            Rooms.update({type: type}, {$set: {state: "playing", timePaused: timer.timeWhenPaused()}});
            state = "playing";
        }
    };
    this.cancelTimer = function() {
        timer.pause();
    };
    this.getState = function() {
        return state;
    };
    this.type = type;

    this.songTimer();
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex ;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function Timer(callback, delay) {
    var timerId, start, remaining = delay;
    var timeWhenPaused = 0;
    var timePaused = new Date();

    this.pause = function() {
        Meteor.clearTimeout(timerId);
        remaining -= new Date() - start;
        timePaused = new Date();
    };

    this.resume = function() {
        start = new Date();
        Meteor.clearTimeout(timerId);
        timerId = Meteor.setTimeout(callback, remaining);
        timeWhenPaused += new Date() - timePaused;
    };

    this.timeWhenPaused = function() {
        return timeWhenPaused;
    };

    this.resume();
}

Meteor.users.deny({update: function () { return true; }});
Meteor.users.deny({insert: function () { return true; }});
Meteor.users.deny({remove: function () { return true; }});

function getSongDuration(query, artistName){
    var duration;
    var search = query;
    query = query.toLowerCase().split(" ").join("%20");

    var res = Meteor.http.get('https://api.spotify.com/v1/search?q=' + query + '&type=track');

    for(var i in res.data){
        for(var j in res.data[i].items){
            if(search.indexOf(res.data[i].items[j].name) !== -1 && artistName.indexOf(res.data[i].items[j].artists[0].name) !== -1){
                duration = res.data[i].items[j].duration_ms / 1000;
                return duration;
            }
        }
    }
}

function getSongAlbumArt(query, artistName){
    var albumart;
    var search = query;
    query = query.toLowerCase().split(" ").join("%20");

    var res = Meteor.http.get('https://api.spotify.com/v1/search?q=' + query + '&type=track');
    for(var i in res.data){
        for(var j in res.data[i].items){
            if(search.indexOf(res.data[i].items[j].name) !== -1 && artistName.indexOf(res.data[i].items[j].artists[0].name) !== -1){
                albumart = res.data[i].items[j].album.images[1].url
                return albumart;
            }
        }
    }
}

//var room_types = ["edm", "nightcore"];
var songsArr = [];

function getSongsByType(type) {
    if (type === "edm") {
        return [
            {id: "aE2GCa-_nyU", mid: "fh6_Gf", title: "Radioactive", duration: getSongDuration("Radioactive - Lindsey Stirling and Pentatonix", "Lindsey Stirling, Pentatonix"), artist: "Lindsey Stirling, Pentatonix", type: "YouTube", img: "https://i.scdn.co/image/62167a9007cef2e8ef13ab1d93019312b9b03655"},
            {id: "aHjpOzsQ9YI", mid: "goG88g", title: "Crystallize", artist: "Lindsey Stirling", duration: getSongDuration("Crystallize", "Lindsey Stirling"), type: "YouTube", img: "https://i.scdn.co/image/b0c1ccdd0cd7bcda741ccc1c3e036f4ed2e52312"}
        ];
    } else if (type === "nightcore") {
        return [{id: "f7RKOP87tt4", mid: "5pGGog", title: "Monster (DotEXE Remix)", duration: getSongDuration("Monster (DotEXE Remix)", "Meg & Dia"), artist: "Meg & Dia", type: "YouTube", img: "https://i.scdn.co/image/35ecdfba9c31a6c54ee4c73dcf1ad474c560cd00"}];
    } else {
        return [{id: "dQw4w9WgXcQ", mid: "6_fdr4", title: "Never Gonna Give You Up", duration: getSongDuration("Never Gonna Give You Up", "Rick Astley"), artist: "Rick Astley", type: "YouTube", img: "https://i.scdn.co/image/5246898e19195715e65e261899baba890a2c1ded"}];
    }
}

Rooms.find({}).fetch().forEach(function(room) {
    var type = room.type;
    if (Playlists.find({type: type}).count() === 0) {
        if (type === "edm") {
            Playlists.insert({type: type, songs: getSongsByType(type)});
        } else if (type === "nightcore") {
            Playlists.insert({type: type, songs: getSongsByType(type)});
        } else {
            Playlists.insert({type: type, songs: getSongsByType(type)});
        }
    }
    if (Playlists.findOne({type: type}).songs.length === 0) {
        // Add a global video to Playlist so it can proceed
    } else {
        stations.push(new Station(type));
    }
});

Accounts.validateNewUser(function(user) {
    var username;
    if (user.services) {
        if (user.services.github) {
            username = user.services.github.username;
        } else if (user.services.facebook) {
            username = user.services.facebook.first_name;
        } else if (user.services.password) {
            username = user.username;
        }
    }
    if (Meteor.users.find({"profile.usernameL": username.toLowerCase()}).count() !== 0) {
        throw new Meteor.Error(403, "An account with that username already exists.");
    } else {
        return true;
    }
});

Accounts.onCreateUser(function(options, user) {
    var username;
    if (user.services) {
        if (user.services.github) {
            username = user.services.github.username;
        } else if (user.services.facebook) {
            username = user.services.facebook.first_name;
        } else if (user.services.password) {
            username = user.username;
        }
    }
    user.profile = {username: username, usernameL: username.toLowerCase(), rank: "default", liked: [], disliked: []};
    return user;
});

ServiceConfiguration.configurations.remove({
    service: "facebook"
});

ServiceConfiguration.configurations.insert({
    service: "facebook",
    appId: "1496014310695890",
    secret: "9a039f254a08a1488c08bb0737dbd2a6"
});

ServiceConfiguration.configurations.remove({
    service: "github"
});

ServiceConfiguration.configurations.insert({
    service: "github",
    clientId: "dcecd720f47c0e4001f7",
    secret: "375939d001ef1a0ca67c11dbf8fb9aeaa551e01b"
});

Meteor.publish("playlists", function() {
    return Playlists.find({})
});

Meteor.publish("rooms", function() {
    return Rooms.find({});
});

Meteor.publish("queues", function() {
    return Queues.find({});
});

Meteor.publish("chat", function() {
    return Chat.find({});
});

Meteor.publish("userProfiles", function() {
    return Meteor.users.find({}, {fields: {profile: 1, createdAt: 1}});
});

Meteor.publish("isAdmin", function() {
    return Meteor.users.find({_id: this.userId, "profile.rank": "admin"});
});

function isAdmin() {
    var userData = Meteor.users.find(Meteor.userId());
    if (Meteor.userId() && userData.count !== 0 && userData.fetch()[0].profile.rank === "admin") {
        return true;
    } else {
        return false;
    }
}

Meteor.methods({
    sendMessage: function(type, message) {
        if (Meteor.userId()) {
            var user = Meteor.user();
            var time = new Date();
            var username = user.profile.username;
            var rank = user.profile.rank;
            if (message.length === 0) {
                throw new Meteor.Error(406, "Message length cannot be 0.");
            }
            if (message.length > 300) {
                throw new Meteor.Error(406, "Message length cannot be more than 300 characters long..");
            }
            Chat.insert({type: type, rank: rank, message: message, time: time, username: username});
            return true;
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    likeSong: function(mid) {
        if (Meteor.userId()) {
            var user = Meteor.user();
            if (user.profile.liked.indexOf(mid) === -1) {
                Meteor.users.update({"profile.username": user.profile.username}, {$push: {"profile.liked": mid}});
                Playlists.update({"songs.mid": mid}, {$inc: {"songs.$.likes": 1}})
            } else {
                Meteor.users.update({"profile.username": user.profile.username}, {$pull: {"profile.liked": mid}});
                Playlists.update({"songs.mid": mid}, {$inc: {"songs.$.likes": -1}})
            }

            if (user.profile.disliked.indexOf(mid) !== -1) {
                Meteor.users.update({"profile.username": user.profile.username}, {$pull: {"profile.disliked": mid}});
                Playlists.update({"songs.mid": mid}, {$inc: {"songs.$.dislikes": -1}})
            }
            return true;
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    dislikeSong: function(mid) {
        if (Meteor.userId()) {
            var user = Meteor.user();
            if (user.profile.disliked.indexOf(mid) === -1) {
                Meteor.users.update({"profile.username": user.profile.username}, {$push: {"profile.disliked": mid}});
                Playlists.update({"songs.mid": mid}, {$inc: {"songs.$.dislikes": 1}});
            } else {
                Meteor.users.update({"profile.username": user.profile.username}, {$pull: {"profile.disliked": mid}});
                Playlists.update({"songs.mid": mid}, {$inc: {"songs.$.dislikes": -1}});
            }

            if (user.profile.liked.indexOf(mid) !== -1) {
                Meteor.users.update({"profile.username": user.profile.username}, {$pull: {"profile.liked": mid}});
                Playlists.update({"songs.mid": mid}, {$inc: {"songs.$.likes": -1}});
            }
            return true;
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    submitReport: function(report, id) {
        var obj = report;
        obj.id = id;
        Reports.insert(obj);
    },
    shufflePlaylist: function(type) {
        if (isAdmin()) {
            getStation(type, function(station) {
                if (station === undefined) {
                    throw new Meteor.Error(404, "Station not found.");
                } else {
                    station.cancelTimer();
                    station.shufflePlaylist();
                }
            });
        }
    },
    skipSong: function(type) {
        if (isAdmin()) {
            getStation(type, function(station) {
                if (station === undefined) {
                    throw new Meteor.Error(404, "Station not found.");
                } else {
                    station.skipSong();
                }
            });
        }
    },
    pauseRoom: function(type) {
        if (isAdmin()) {
            getStation(type, function(station) {
                if (station === undefined) {
                    throw new Meteor.Error(403, "Room doesn't exist.");
                } else {
                    station.pauseRoom();
                }
            });
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    resumeRoom: function(type) {
        if (isAdmin()) {
            getStation(type, function(station) {
                if (station === undefined) {
                    throw new Meteor.Error(403, "Room doesn't exist.");
                } else {
                    station.resumeRoom();
                }
            });
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    createUserMethod: function(formData, captchaData) {
        var verifyCaptchaResponse = reCAPTCHA.verifyCaptcha(this.connection.clientAddress, captchaData);
        if (!verifyCaptchaResponse.success) {
            console.log('reCAPTCHA check failed!', verifyCaptchaResponse);
            throw new Meteor.Error(422, 'reCAPTCHA Failed: ' + verifyCaptchaResponse.error);
        } else {
            console.log('reCAPTCHA verification passed!');
            Accounts.createUser({
                username: formData.username,
                email: formData.email,
                password: formData.password
            });
        }
        return true;
    },
    addSongToQueue: function(type, songData) {
        if (Meteor.userId()) {
            type = type.toLowerCase();
            if (Rooms.find({type: type}).count() === 1) {
                if (Queues.find({type: type}).count() === 0) {
                    Queues.insert({type: type, songs: []});
                }
                if (songData !== undefined && Object.keys(songData).length === 5 && songData.type !== undefined && songData.title !== undefined && songData.title !== undefined && songData.artist !== undefined && songData.img !== undefined) {
                    songData.duration = getSongDuration(songData.title, songData.artist);
                    songData.img = getSongAlbumArt(songData.title, songData.artist);
                    var mid = createUniqueSongId();
                    if (mid !== undefined) {
                        songData.mid = mid;
                        Queues.update({type: type}, {
                            $push: {
                                songs: {
                                    id: songData.id,
                                    mid: songData.mid,
                                    title: songData.title,
                                    artist: songData.artist,
                                    duration: songData.duration,
                                    img: songData.img,
                                    type: songData.type
                                }
                            }
                        });
                        return true;
                    } else {
                        throw new Meteor.Error(500, "Am error occured.");
                    }
                } else {
                    throw new Meteor.Error(403, "Invalid data.");
                }
            } else {
                throw new Meteor.Error(403, "Invalid genre.");
            }
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    updateQueueSong: function(genre, oldSong, newSong) {
        if (isAdmin()) {
            newSong.mid = oldSong.mid;
            Queues.update({type: genre, "songs": oldSong}, {$set: {"songs.$": newSong}});
            return true;
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    updatePlaylistSong: function(genre, oldSong, newSong) {
        if (isAdmin()) {
            newSong.mid = oldSong.mid;
            Playlists.update({type: genre, "songs": oldSong}, {$set: {"songs.$": newSong}});
            return true;
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    removeSongFromQueue: function(type, mid) {
        if (isAdmin()) {
            type = type.toLowerCase();
            Queues.update({type: type}, {$pull: {songs: {mid: mid}}});
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    removeSongFromPlaylist: function(type, mid) {
        if (isAdmin()) {
            type = type.toLowerCase();
            Playlists.update({type: type}, {$pull: {songs: {mid: mid}}});
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    addSongToPlaylist: function(type, songData) {
        if (isAdmin()) {
            type = type.toLowerCase();
            if (Rooms.find({type: type}).count() === 1) {
                if (Playlists.find({type: type}).count() === 0) {
                    Playlists.insert({type: type, songs: []});
                }
                if (songData !== undefined && Object.keys(songData).length === 7 && songData.type !== undefined && songData.mid !== undefined && songData.title !== undefined && songData.title !== undefined && songData.artist !== undefined && songData.duration !== undefined && songData.img !== undefined) {
                    songData.likes = 0;
                    songData.dislikes = 0

                    Playlists.update({type: type}, {
                        $push: {
                            songs: {
                                id: songData.id,
                                mid: songData.mid,
                                title: songData.title,
                                artist: songData.artist,
                                duration: songData.duration,
                                img: songData.img,
                                type: songData.type,
                                likes: songData.likes,
                                dislikes: songData.dislikes
                            }
                        }
                    });
                    Queues.update({type: type}, {$pull: {songs: {mid: songData.mid}}});
                    return true;
                } else {
                    throw new Meteor.Error(403, "Invalid data.");
                }
            } else {
                throw new Meteor.Error(403, "Invalid genre.");
            }
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    createRoom: function(display, tag) {
        if (isAdmin()) {
            createRoom(display, tag);
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    deleteRoom: function(type){
        if (isAdmin()) {
            Rooms.remove({type: type});
            Playlists.remove({type: type});
            Queues.remove({type: type});
            return true;
        } else {
            throw new Meteor.Error(403, "Invalid permissions.");
        }
    },
    getUserNum: function(){
        return Object.keys(Meteor.default_server.sessions).length;
    }
});