var MongoClient = require('mongodb').MongoClient;
var Hoek = require('hoek');
var async = require('async');

var defaults = {
  collection: 'Jobs'
};

exports.register = function(plugin, options, next) {

  var settings = Hoek.clone(options);
  settings = Hoek.applyToDefaults(defaults, settings);

  var self = this;

  MongoClient.connect(settings.connectionUrl, function(err, db) {
    if (err) {
      console.log(err);
      return next(err);
    }

    self.db = db;

    self.collection = db.collection(settings.collection);

    plugin.expose('collection', self.collection);

    plugin.expose('db', self.db);

    next();
  });
};

exports.register.attributes = {
  name: 'jobs',
  pkg: require('../package.json')
};
