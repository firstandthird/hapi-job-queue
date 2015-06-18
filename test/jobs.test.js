var MongoClient = require('mongodb').MongoClient;

var Code = require('code');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var Hapi = require('hapi');
var Joi = require('joi');
var async = require('async');

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var expect = Code.expect;

var mongoUrl = 'mongodb://localhost:27017/hapi-job-queue-test';

var server;
var server2;
var plugin;
var plugin2;
var output = null;
var counter = 0;

before(function(done) {
  server = new Hapi.Server();
  server.connection({port: 3000});
  server2 = new Hapi.Server();
  server2.connection({port: 3001});
  output = null;
  single = false;
  counter = 0;

  server.register(require('hapi-auth-bearer-token'), function (err) {
    server.auth.strategy('simple', 'bearer-access-token', {
      allowQueryToken: true,
      accessTokenName: 'token',
      validateFunc: function( token, callback ) {
        if(token === "1234"){
          callback(null, true, { token: token });
        } else {
          callback(null, false, { token: token });
        }
      }
    });
  });

  server2.register(require('hapi-auth-bearer-token'), function (err) {
    server2.auth.strategy('simple', 'bearer-access-token', {
      allowQueryToken: true,
      accessTokenName: 'token',
      validateFunc: function( token, callback ) {
        if(token === "1234"){
          callback(null, true, { token: token });
        } else {
          callback(null, false, { token: token });
        }
      }
    });
  });

  MongoClient.connect(mongoUrl, function(err, db) {
    if (err) {
      return next(err);
    }

    db.dropDatabase(function(err) {

      server.register([
        { register: require('../'), options: {
          connectionUrl: mongoUrl,
          endpoint: '/jobs',
          auth: 'simple',
          jobs: [
            {
              name: 'test-job',
              enabled: true,
              schedule: 'every 1 seconds',
              method: function(data, cb) {
                output = data.time;
                counter++;

                setTimeout(cb, 100);
              },
              tasks: [
                {
                  time: 1
                },
                {
                  time: 2
                }
              ]
            }
          ]
        } }
      ], function() {
        server.method('testMethod', function(data, cb) {
          output = 'methodized';
          setTimeout(cb, 50);
        });

        server.method('deep.testMethod', function(data, cb) {
          output = 'methodized';
          setTimeout(cb, 50);
        });

        plugin = server.plugins.jobs;


        //second test server
        server2.register([
          { register: require('../'), options: {
            connectionUrl: mongoUrl,
            endpoint: '/jobs',
            auth: 'simple',
            jobs: [
              {
                name: 'test-job',
                enabled: true,
                schedule: 'every 1 seconds',
                method: function(data, cb) {
                  output = data.time;
                  counter++;

                  setTimeout(cb, 100);
                },
                tasks: [
                  {
                    time: 1
                  },
                  {
                    time: 2
                  }
                ]
              }
            ]
          } }
        ], function() {
          server2.method('testMethod', function(data, cb) {
            output = 'methodized';
            setTimeout(cb, 50);
          });

          plugin2 = server2.plugins.jobs;

          done();
        });

      });

    });
  });
});

describe('job queue', { timeout: 5000 }, function() {

  describe('setup', function() {
    it('should expose db connection', function(done) {
      expect(plugin.db).to.exist();
      done();
    });

    it('should expose database collection', function(done) {
      expect(plugin.collection).to.exist();
      done();
    });

    it('should expose settings object', function(done) {
      expect(plugin.settings).to.exist();
      done();
    });

    it('should initialize jobs', function(done) {
      plugin.collection.find({name: 'test-job'}).toArray(function(err, jobs) {
        expect(err).to.not.exist();

        expect(jobs.length).to.equal(1);

        var job = jobs[0];

        expect(job.name).to.equal('test-job');
        expect(job.locked).to.equal(false);
        expect(job.lastRun).to.equal(undefined);
        expect(job.timeToRun).to.equal(undefined);
        expect(job.group).to.deep.equal(['test-job']);
        expect(job.tasks).to.deep.equal([{time: 1}, {time: 2}]);
        expect(job.enabled).to.equal(true);
        expect(job.nextRun).to.exist();

        done();
      });
    });
  });

  describe('methods', function() {
    it('should add a job', function(done) {
      plugin.add({
        name: 'test-job2',
        enabled: true,
        group: 'group1',
        cron: '* 15 10 ? * *',
        cronSeconds: true,
        method: function(cb) {
          output = 2;
          cb();
        }
      }, function(err) {
        expect(err).to.not.exist();

        plugin.collection.find({name: 'test-job2'}).toArray(function(err, jobs) {
          expect(jobs.length).to.equal(1);

          var job = jobs[0];

          expect(job.name).to.equal('test-job2');
          expect(job.locked).to.equal(false);
          expect(job.lastRun).to.equal(undefined);
          expect(job.timeToRun).to.equal(undefined);
          expect(job.group).to.deep.equal(['group1']);
          expect(job.tasks).to.equal(null);
          expect(job.enabled).to.equal(true);
          expect(job.nextRun).to.exist();

          done();
        });

      });
    });

    it('should add a job only once', function(done) {
      plugin.add({
        name: 'test-job2',
        enabled: true,
        group: 'group1',
        cron: '* 15 10 ? * *',
        cronSeconds: true,
        method: function(cb) {
          output = 2;
          cb();
        }
      }, function(err) {
        expect(err.toString()).to.equal('Error: Job already loaded');
        done();
      });
    });


    it('should only add a job once', function(done) {
      plugin.add({
        name: 'test-job',
        enabled: false,
        method: function(cb) {
          output = 'ran';
          cb();
        }
      }, function(err) {
        expect(err).to.deep.equal(new Error('Job already loaded'));

        plugin.collection.find({name: 'test-job'}).toArray(function(err, jobs) {
          expect(jobs.length).to.equal(1);
          done();
        });

      });
    });

    it('should add job to job object', function(done) {
      expect(plugin.jobs['test-job']).to.exist();
      expect(typeof plugin.jobs['test-job'].method).to.equal('function');
      done();
    });

    it('should check if a job is valid before disabling', function(done) {
      plugin.disable('fake-job', function(err) {
        expect(err).to.deep.equal(new Error('Job doesn\'t exist'));
        done();
      });
    });

    it('should disable a job', function(done) {
      plugin.disable('test-job', function(err) {
        expect(err).to.not.exist();

        plugin.collection.find({name: 'test-job'}).toArray(function(err, jobs) {

          expect(err).to.not.exist();
          expect(jobs.length).to.equal(1);

          expect(jobs[0].enabled).to.equal(false);

          done();
        });
      });
    });

    it('should check if a job is valid before enabling', function(done) {
      plugin.enable('fake-job', function(err) {
        expect(err).to.deep.equal(new Error('Job doesn\'t exist'));
        done();
      });
    });

    it('should enable a job', function(done) {
      plugin.enable('test-job', function(err) {
        expect(err).to.not.exist();

        plugin.collection.find({name: 'test-job'}).toArray(function(err, jobs) {

          expect(err).to.not.exist();
          expect(jobs.length).to.equal(1);

          expect(jobs[0].enabled).to.equal(true);

          done();
        });
      });
    });

    it('should enable a group', function(done) {
      plugin.enableGroup('test-job', function(err) {
        expect(err).to.not.exist();

        plugin.collection.find({group: 'test-job'}).toArray(function(err, jobs) {

          expect(err).to.not.exist();
          expect(jobs.length).to.equal(1);

          expect(jobs[0].enabled).to.equal(true);

          done();
        });
      });
    });

    it('should disable a group', function(done) {
      plugin.disableGroup('test-job', function(err) {
        expect(err).to.not.exist();

        plugin.collection.find({group: 'test-job'}).toArray(function(err, jobs) {

          expect(err).to.not.exist();
          expect(jobs.length).to.equal(1);

          expect(jobs[0].enabled).to.equal(false);

          done();
        });
      });
    });

    it('should re-schedule a job', function(done) {
      plugin.reschedule('test-job', { schedule: 'every 30 seconds' }, function(err) {
        expect(err).to.not.exist();

        expect(plugin.jobs['test-job'].schedule).to.equal('every 30 seconds');

        done();
      });
    });
  });

  describe('runner', function() {
    it('should run a job at the specified time', function(done) {
      output = null;
      counter = 0;

      // tests multi server setups.
      async.parallel([
        function(next) {
          plugin.enable('test-job', function(err) {
            plugin.reschedule('test-job', { schedule: 'every 1 seconds' }, function(err) {
              expect(err).to.not.exist();
              next();
            });
          });
        },
        function(next) {
          plugin2.enable('test-job', function(err) {
            plugin2.reschedule('test-job', { schedule: 'every 1 seconds' }, function(err) {
              expect(err).to.not.exist();
              next();
            });
          });
        }
      ], function() {
        setTimeout(function() {
          expect(output).to.equal(2);
          expect(counter).to.equal(2);
          done();
        }, 1400);
      });


    });

    it('should lock a running job', function(done) {
      output = null;
      plugin.reschedule('test-job', { schedule: 'every 1 seconds' }, function(err) {
        expect(err).to.not.exist();

        setTimeout(function() {
          plugin.collection.find({group: 'test-job'}).toArray(function(err, jobs) {
            expect(err).to.not.exist();

            expect(jobs[0].locked).to.equal(true);
            done();
          });
        }, 1050);
      });
    });

    it('should unlock a job when it finishes', function(done) {
      output = null;
      plugin.reschedule('test-job', { schedule: 'every 1 seconds' }, function(err) {
        expect(err).to.not.exist();

        setTimeout(function() {
          plugin.collection.find({group: 'test-job'}).toArray(function(err, jobs) {
            expect(err).to.not.exist();

            expect(jobs[0].locked).to.equal(false);
            done();
          });
        }, 1400);
      });
    });

    it('should time how long a job takes to process', function(done) {
      plugin.collection.find({group: 'test-job'}).toArray(function(err, jobs) {
        expect(err).to.not.exist();

        expect(jobs[0].timeToRun).to.be.above(0);
        done();
      });
    });

    it('should run a job right away', function(done) {
      single = false;

      plugin.add({
        name: 'test-single',
        enabled: true,
        single: true,
        method: function(data, cb) {
          single = data;
          cb();
        }
      }, function(err) {
        expect(err).to.not.exist();

        expect(single).to.equal(false);

        plugin.runSingle('test-single', [true], function(err, jobError) {
          expect(err).to.not.exist();
          expect(jobError).to.not.exist();
          expect(single).to.equal(true);
          done();
        });
      });
    });

    it('should run a scheduled job right away', function(done) {
      single = false;

      plugin.add({
        name: 'test-single3',
        enabled: true,
        schedule: 'at 6:00 am',
        method: function(data, cb) {
          single = data;
          cb();
        }
      }, function(err) {
        expect(err).to.not.exist();

        expect(single).to.equal(false);

        plugin.runSingle('test-single3', [true], function(err, jobError) {
          expect(err).to.not.exist();
          expect(jobError).to.not.exist();
          expect(single).to.equal(true);
          done();
        });
      });
    });

    it('should handle a failed job', function(done) {
      plugin.add({
        name: 'test-fail',
        enabled: true,
        single: true,
        method: function(data, cb) {
          cb(new Error('Test error'));
        }
      }, function(err) {
        expect(err).to.not.exist();

        plugin.runSingle('test-fail', [true], function(err, jobError) {
          expect(err).to.not.exist();
          expect(jobError.toString()).to.equal('Error: Test error');
          done();
        });
      });
    });

    it('should run a job right away without data', function(done) {
      var single = false;

      plugin.add({
        name: 'test-single2',
        enabled: true,
        single: true,
        method: function(data, cb) {
          single = true;
          cb();
        }
      }, function(err) {
        expect(err).to.not.exist();

        expect(single).to.equal(false);

        plugin.runSingle('test-single2', function(err, jobError) {
          expect(err).to.not.exist();
          expect(jobError).to.not.exist();
          expect(single).to.equal(true);
          done();
        });
      });
    });

    it('should run a job with empty data', function(done) {
      var single = false;

      plugin.add({
        name: 'test-single4',
        enabled: true,
        single: true,
        method: function(data, cb) {
          single = true;
          cb();
        }
      }, function(err) {
        expect(err).to.not.exist();

        expect(single).to.equal(false);

        plugin.runSingle('test-single4', {}, function(err, jobError) {
          expect(err).to.not.exist();
          expect(jobError).to.not.exist();
          expect(single).to.equal(true);
          done();
        });
      });
    });

    it('should run a job method by name', function(done) {
      output = null;

      plugin.add({
        name: 'test-method',
        enabled: true,
        single: true,
        method: 'testMethod'
      }, function(err) {
        expect(err).to.not.exist();

        expect(output).to.equal(null);

        plugin.runSingle('test-method', function(err, jobError) {
          expect(err).to.not.exist();
          expect(jobError).to.not.exist();
          expect(output).to.equal('methodized');
          done();
        });
      });
    });

    it('should run a job method by name when nested', function(done) {
      output = null;

      plugin.add({
        name: 'deep-test-method',
        enabled: true,
        single: true,
        method: 'deep.testMethod'
      }, function(err) {
        expect(err).to.not.exist();

        expect(output).to.equal(null);

        plugin.runSingle('deep-test-method', function(err, jobError) {
          expect(err).to.not.exist();
          expect(jobError).to.not.exist();
          expect(output).to.equal('methodized');
          done();
        });
      });
    });

    //TODO: Still thinking about groups - Not sure if they're needed
    it.skip('should run a group of jobs right away', function(done) {
      done();
    });
  });

  describe('api', function() {

    it('should return all jobs', function(done) {
      server.inject({
        method: 'get',
        url: '/jobs/?token=1234'
      }, function(response) {
        Joi.validate(response, {
          raw: Joi.any(),
          headers: Joi.any(),
          rawPayload: Joi.any(),
          payload: Joi.any(),
          request: Joi.any(),
          statusCode: Joi.allow(200),
          result: Joi.array().items(
            Joi.object().keys({
              _id: Joi.any(),
              name: Joi.string(),
              tasks: Joi.array().allow(null),
              group: Joi.array(),
              locked: Joi.boolean(),
              enabled: Joi.boolean(),
              nextRun: Joi.date().allow(null),
              lastRun: Joi.date(),
              single: Joi.boolean(),
              timeToRun: Joi.number()
            })
          )
        }, function(err, res) {
          if (err) {
            console.log(err);
          }

          expect(err).to.not.exist();
          done();
        });
      });
    });

    it('should enable a job', function(done) {
      plugin.disable('test-job', function(err) {
        expect(err).to.not.exist();

        server.inject({
          method: 'get',
          url: '/jobs/enable/test-job?token=1234'
        }, function(response) {
          expect(response.statusCode).to.equal(200);
          expect(response.result).to.deep.equal({ success: true});

          plugin.collection.find({name: 'test-job'}).toArray(function(err, jobs) {

            expect(err).to.not.exist();
            expect(jobs.length).to.equal(1);

            expect(jobs[0].enabled).to.equal(true);

            done();
          });
        });
      });
    });

    it('should disable a job', function(done) {
      plugin.enable('test-job', function(err) {
        expect(err).to.not.exist();

        server.inject({
          method: 'get',
          url: '/jobs/disable/test-job?token=1234'
        }, function(response) {
          expect(response.statusCode).to.equal(200);
          expect(response.result).to.deep.equal({ success: true});

          plugin.collection.find({group: 'test-job'}).toArray(function(err, jobs) {

            expect(err).to.not.exist();
            expect(jobs.length).to.equal(1);

            expect(jobs[0].enabled).to.equal(false);

            done();
          });
        });
      });
    });

    it('should run a job', function(done) {
      single = false;

      server.inject({
        method: 'post',
        url: '/jobs/run/test-single?token=1234',
        payload: [true]
      }, function(response) {
        expect(response.statusCode).to.equal(200);
        expect(response.result).to.deep.equal({ success: true});
        expect(single).to.equal(true);
        done();
      });
    });

    it('should use auth setting', function(done) {
      server.inject({
        method: 'get',
        url: '/jobs/'
      }, function(response) {
        expect(response.statusCode).to.equal(401);
        done();
      });
    });
  });

});
