var MongoClient = require('mongodb').MongoClient;

var Code = require('code');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var Hapi = require('hapi');

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var expect = Code.expect;

var mongoUrl = 'mongodb://localhost:27017/hapi-job-queue-test';

var server;
var plugin;
var output = null;

before(function(done) {
  server = new Hapi.Server();
  server.connection({port: 3000});
  output = null;

  MongoClient.connect(mongoUrl, function(err, db) {
    if (err) {
      return next(err);
    }

    db.dropDatabase(function(err) {

      server.register([
        { register: require('../'), options: {
          connectionUrl: mongoUrl,
          jobs: [
            {
              name: 'test-job',
              enabled: true,
              schedule: 'every 1 seconds',
              method: function(data, cb) {
                output = data.time;

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
        plugin = server.plugins.jobs;
        done();
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
      plugin.enable('test-job', function(err) {
        plugin.reschedule('test-job', { schedule: 'every 1 seconds' }, function(err) {
          expect(err).to.not.exist();

          setTimeout(function() {
            expect(err).to.not.exist();

            expect(output).to.equal(2);
            done();
          }, 1400);
        });
      });
    });

    it.skip('should run a group of jobs at the specified time', function(done) {
      done();
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

    it.('should lock grouped jobs', function(done) {
      expect(false).to.equal(true);
      done();
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

    it.skip('should unlock grouped jobs when it finishes', function(done) {
      done();
    });

    it.skip('should time how long a job takes to process', function(done) {
      done();
    });

    it.skip('should handle a failed job', function(done) {
      done();
    });

    it.skip('should run a job method by name', function(done) {
      done();
    });

    it.skip('should run a job method by function', function(done) {
      done();
    });

    it.skip('should pass parameters to job method', function(done) {
      done();
    });

    it.skip('should run a job right away', function(done) {
      done();
    });

    // This one is to batch tasks together. Still figuring out how to handle it.
    it.skip('should queue up instances of a job', function(done) {
      done();
    });

    it.skip('should run a group of jobs right away', function(done) {
      done();
    });
  });

  describe('api', function() {
    it.skip('should expose an api endpoint', function(done) {
      done();
    });

    it.skip('should return all jobs', function(done) {
      done();
    });

    it.skip('should enable a job', function(done) {
      done();
    });

    it.skip('should disable a job', function(done) {
      done();
    });

    it.skip('should run a job', function(done) {
      done();
    });

    it.skip('should return stats', function(done) {
      done();
    });
  });

});
