var url = require('url');
var Boom = require('boom');

module.exports = function(server) {
  var plugin = server.plugins.jobs;
  var endpoint = plugin.settings.endpoint;

  return {
    jobs: {
      method: 'GET',
      path: url.resolve(endpoint, '/'),
      handler: function(request, reply) {
        plugin.getJobs(function(err, jobs) {
          if (err) {
            return Boom.badImplementation('Error getting jobs');
          }

          reply(jobs);
        });
      }
    },
    enable: {
      method: 'GET',
      path: url.resolve(endpoint, '/enable/') + '{job}',
      handler: function(request, reply) {
        plugin.enable(request.params.job, function(err) {
          if (err) {
            return Boom.badImplementation('Error enabling job');
          }

          reply({success: true});
        });
      }
    },
    disable: {
      method: 'GET',
      path: url.resolve(endpoint, '/disable/') + '{job}',
      handler: function(request, reply) {
        plugin.disable(request.params.job, function(err) {
          if (err) {
            return Boom.badImplementation('Error disabling job');
          }

          reply({success: true});
        });
      }
    },
    run: {
      method: 'POST',
      path: url.resolve(endpoint, '/run/') + '{job}',
      handler: function(request, reply) {
        plugin.runSingle(request.params.job, request.payload, function(err, jobError) {
          if (err || jobError) {
            return Boom.badImplementation('Error running job');
          }

          reply({success: true});
        });
      }
    }
  };
};
