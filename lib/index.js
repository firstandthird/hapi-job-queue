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
      return done(new Error('Job already loaded'));
    }

    self.jobs[job.name] = job;

    var group = [job.name];

    if (typeof job.group === 'string') {
      group = [job.group];
    } else if (_.isArray(job.group)) {
      group = job.group;
    }

    self.jobs[job.name].group = group;

    var nextRun = null;

    if (!job.single) {
      if (job.schedule) {
        self.jobs[job.name].parsedTime = later.parse.text(job.schedule);
      } else {
        self.jobs[job.name].parsedTime = later.parse.cron(job.cron, job.cronSeconds || false);
      }

      self.jobs[job.name].nextRun = later.schedule(self.jobs[job.name].parsedTime).next(1);

      nextRun = self.jobs[job.name].nextRun;
    }

    self.collection.update({ name: job.name }, {
      name: job.name,
      tasks: job.tasks,
      group: group,
      locked: false,
      enabled: job.enabled || false,
      nextRun: nextRun,
      single: job.single || false
    }, { upsert: true}, function(err) {
      if (err) {
        return done(err);
      }

      if (job.single) {
        return done();
      } else {
        self.queueJob(job.name, done);
      }
    });

  };

  this.enableJob = function(job, done) {
    if (typeof self.jobs[job] === 'undefined') {
      return done(new Error('Job doesn\'t exist'));
    }

    self.collection.update({ name: job }, {
      $set: {
        enabled: true
      }
    }, done);
  };

  this.disableJob = function(job, done) {
    if (typeof self.jobs[job] === 'undefined') {
      return done(new Error('Job doesn\'t exist'));
    }

    self.collection.update({name: job}, {
      $set: {
        enabled: false
      }
    }, done);
  };

  this.enableGroup = function(group, done) {
    self.collection.update({ group: group }, {
      $set: {
        enabled: true
      }
    }, { multi: true }, done);
  };

  this.disableGroup = function(group, done) {
    self.collection.update({ group: group }, {
      $set: {
        enabled: false
      }
    }, { multi: true }, done);
  };

  this.runSingle = function(job, data, done) {

    if (typeof data === 'function') {
      done = data;
      data = [null];
    }

    // validate job in db
    self.collection.findOne({ name: job}, function(err, jobData) {
      if (err) {
        return plugin.log(['hapi-job-queue', 'error'], {error: err});
      }

      if (!jobData.locked && jobData.enabled) {
        self.collection.update({name: job}, {
          $set: {
            locked: true
          }
        }, function(err) {
          if (err) {
            return plugin.log(['hapi-job-queue', 'error'], {error: err});
          }

          var startTime = +new Date();

          async.each(data, function(task, cb) {
            self.jobs[job].method.call(plugin, task, cb);
          }, function(err) {
            if (err) {
              plugin.log(['hapi-job-queue', 'error'], {error: err});              
            }

            var endTime = +new Date();
            var timeToRun = endTime - startTime;

            self.collection.update({ name: job }, {
              $set: {
                lastRun: new Date(),
                locked: false,
                timeToRun: timeToRun
              }
            }, function(err) {
              if (err) {
                plugin.log(['hapi-job-queue', 'error'], {error: err});
              }

              done(err);
            });
          });
        });
      }
    });
  };

  this.reschedule = function(job, schedule, done) {
    self.dequeueJob(job);

    if (schedule.schedule) {
      self.jobs[job].parsedTime = later.parse.text(schedule.schedule);
      self.jobs[job].schedule = schedule.schedule;
    } else {
      self.jobs[job].parsedTime = later.parse.cron(schedule.cron, schedule.cronSeconds || self.jobs[job].cronSeconds);
      self.jobs[job].cron = schedule.cron;
      self.jobs[job].cronSeconds = schedule.cronSeconds || self.jobs[job].cronSeconds;
    }

    self.jobs[job].nextRun = later.schedule(self.jobs[job].parsedTime).next(1);

    self.collection.update({ name: job }, {
      $set: {
        nextRun: self.jobs[job].nextRun
      }
    }, { multi: false}, function(err) {
      if (err) {
        plugin.log(['hapi-job-queue', 'error'], {error: err});
        return done(err);
      }

      self.queueJob(job, done);
    });
  };

  this.dequeueJob = function(job) {
     if (self.jobs[job] && self.jobs[job].timer) {
       self.jobs[job].timer.clear();
     }
  };

  this.queueJob = function(job, done) {
    self.jobs[job].timer = later.setInterval(function() {
      // validate job in db
      self.collection.findOne({ name: job}, function(err, jobData) {
        if (err) {
          return plugin.log(['hapi-job-queue', 'error'], {error: err});
        }

        var nextRun = later.schedule(self.jobs[job].parsedTime).next(1);
        self.jobs[job].nextRun = nextRun;

        if (jobData.locked || !jobData.enabled) {
          self.collection.update({ name: job}, {
            $set: {
              nextRun: nextRun
            }
          }, function(err) {
            if (err) {
              return plugin.log(['hapi-job-queue', 'error'], {error: err});
            }
          });
        } else {
          self.collection.update({name: job}, {
            $set: {
              locked: true,
              nextRun: nextRun
            }
          }, function(err) {
            if (err) {
              return plugin.log(['hapi-job-queue', 'error'], {error: err});
            }

            var startTime = +new Date();

            var tasks = jobData.tasks;

            if (!tasks) {
              tasks = [null];
            }

            async.each(tasks, function(task, cb) {
              self.jobs[job].method.call(plugin, task, cb);
            }, function(err) {
              if (err) {
                plugin.log(['hapi-job-queue', 'error'], {error: err});
              }

              var endTime = +new Date();
              var timeToRun = endTime - startTime;

              self.collection.update({ name: job }, {
                $set: {
                  lastRun: new Date(),
                  locked: false,
                  timeToRun: timeToRun
                }
              }, function(err) {
                if (err) {
                  plugin.log(['hapi-job-queue', 'error'], {error: err});
                }
              });
            });
          });
        }
      });
    }, self.jobs[job].parsedTime);

    done();
  };

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
      plugin.expose('jobs', self.jobs);

      //methods
      plugin.expose('add', self.addJob);
      plugin.expose('enable', self.enableJob);
      plugin.expose('disable', self.disableJob);
      plugin.expose('enableGroup', self.enableGroup);
      plugin.expose('disableGroup', self.disableGroup);
      plugin.expose('reschedule', self.reschedule);
      plugin.expose('runSingle', self.runSingle);

      self.setupJobs(next);
    });
  });

  plugin.on('start', function() {
    self.start();
  });
};

exports.register.attributes = {
  name: 'jobs',
  pkg: require('../package.json')
};
