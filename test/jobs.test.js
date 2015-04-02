var Code = require('code');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var Hapi = require('hapi');

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var expect = Code.expect;

describe('job queue', function() {
  var server;
  var plugin;
  var output = null;

  before(function(done) {
    server = new Hapi.Server();
    server.connection({port: 3000});

    server.register([
      { register: require('../'), options: {
        connectionUrl: 'mongodb://localhost:27017/hapi-job-queue-test',
        jobs: {
          'test-job': {
            enabled: false,
            method: function(cb) {
              output = 'ran';
              cb();
            }
          }
        }
      } }
    ], function() {
      plugin = server.plugins.jobs;
      done();
    });
  });

  describe('setup', function() {
    it('should expose db connection', function(done) {
      expect(plugin.db).to.exist();
      done();
    });

    it('should expose database collection', function(done) {
      expect(plugin.collection).to.exist();
      done();
    });

    it.skip('should initialize jobs', function(done) {
      plugin.collection.find({name: 'test-job'}, function(err, jobs) {
        expect(jobs.length).to.equal(1);

        var job = jobs[0];

        expect(job.name).to.equal('test-job');
        expect(job.nextRun).to.equal(+new Date());
        expect(job.locked).to.equal(false);
        expect(job.enabled).to.equal(false);
        expect(job.lastRun).to.equal(undefined);
        expect(job.timeToRun).to.equal(undefined);
        expect(job.group).to.equal('test-job');

        done();
      });
    });
  });

  describe('methods', function() {
    it.skip('should add a job', function(done) {
      plugin.methods.add('test-job2', {
        enabled: true,
        group: 'group1',
        method: function(cb) {
          output = 'ran2';
          cb();
        }
      }, function(err) {
        expect(err).to.not.exist();

        plugin.collection.find({name: 'test-job2'}, function(err, jobs) {
          expect(jobs.length).to.equal(1);

          var job = jobs[0];

          expect(job.name).to.equal('test-job2');
          expect(job.nextRun).to.equal(+new Date());
          expect(job.locked).to.equal(false);
          expect(job.enabled).to.equal(true);
          expect(job.lastRun).to.equal(undefined);
          expect(job.timeToRun).to.equal(undefined);
          expect(job.group).to.equal('group1');

          done();
        });

      });
    });

    it.skip('should only add a job once', function(done) {
      plugin.methods.add('test-job', {
        enabled: false,
        method: function(cb) {
          output = 'ran';
          cb();
        }
      }, function(err) {
        expect(err).to.equal(new Error('Job already loaded'));

        plugin.collection.find({name: 'test-job'}, function(err, jobs) {
          expect(jobs.length).to.equal(1);
          done();
        });

      });
    });

    it.skip('should add job to job object', function(done) {
      expect(plugin.jobs['test-job'].enabled).to.equal(false);
      expect(typeof plugin.jobs['test-job'].method).to.equal('function');
      done();
    });

    it.skip('should enable a job', function(done) {
      plugin.methods.enable('test-job', function(err) {
        expect(err).to.not.exist();

        plugin.collection.find({name: 'test-job'}, function(err, jobs) {
          expect(jobs[0].enabled).to.equal(true);
          expect(plugin.jobs['test-job'].enabled).to.equal(true);
          done();
        });
      });
    });

    it.skip('should disable a job', function(done) {
      plugin.methods.disable('test-job', function(err) {
        expect(err).to.not.exist();

        plugin.collection.find({name: 'test-job'}, function(err, jobs) {
          expect(jobs[0].enabled).to.equal(false);
          expect(plugin.jobs['test-job'].enabled).to.equal(false);
          done();
        });
      });
    });

    it.skip('should re-schedule a job', function(done) {
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

    it.skip('should group jobs by name', function(done) {
      done();
    });
  });

  describe('runner', function() {
    it.skip('should run a job at the specified time', function(done) {
      done();
    });

    it.skip('should run a group of jobs at the specified time', function(done) {
      done();
    });

    it.skip('should lock a running job', function(done) {
      done();
    });

    it.skip('should lock grouped jobs', function(done) {
      done();
    });

    it.skip('should unlock a job when it finishes', function(done) {
      done();
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
