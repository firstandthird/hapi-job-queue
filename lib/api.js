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
    }
  };
};
