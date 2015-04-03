var MongoClient = require('mongodb').MongoClient;
var Hoek = require('hoek');
var async = require('async');
var later = require('later');
var _ = require('lodash');

var defaults = {
  collection: 'Jobs'
};

exports.register = function(plugin, options, next) {

  var self = this;

  this.settings = Hoek.clone(options);
  this.settings = Hoek.applyToDefaults(defaults, this.settings);

  this.jobs = {};

  MongoClient.connect(this.settings.connectionUrl, function(err, db) {
    if (err) {
      return next(err);
    }

    self.db = db;
    db.collection(self.settings.collection, function(err, collection) {
      if (err) {
        return next(err);
      }

      self.collection = collection;

      plugin.expose('collection', self.collection);
      plugin.expose('db', self.db);
      plugin.expose('settings', self.settings);

      self.setupJobs(next);
    });
  });

  this.setupJobs = function(done) {

    async.each(self.settings.jobs, function(job, cb) {
      self.addJob(job, cb);
    }, function(err) {
      if (err) {
        return done(err);
      }

      done();
    });
  };

  this.addJob = function(job, done) {
    
    if (self.jobs[job.name]) {
      return done(new Error('Job already exists'));
    }

    self.jobs[job.name] = job;

    self.collection.update({ name: job.name }, {
      name: job.name,
      tasks: job.tasks,
      group: job.group || [job.name],
      locked: false
    }, { upsert: true}, done);

  };

  this.start = function() {

  };

  plugin.on('start', function() {
    self.start();
  });
};

exports.register.attributes = {
  name: 'jobs',
  pkg: require('../package.json')
};
