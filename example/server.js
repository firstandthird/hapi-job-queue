var Hapi = require('hapi');
var mongoUrl = 'mongodb://localhost:27017/hapi-job-queue-test';

var server = new Hapi.Server();

server.connection({ port: process.argv[2] || 3000 });

server.register([
  { register: require('../'), options: {
    connectionUrl: mongoUrl,
    endpoint: '',
    auth: false,
    jobs: [
      {
        name: 'test-job',
        enabled: true,
        schedule: 'every 5 seconds',
        method: function(data, cb) {
          console.log(data);

          setTimeout(cb, 100);
        },
        tasks: ['Tick', 'Tock']
      }
    ]
  } }
], function(err) {
  if (err) {
    console.error(err);
  }
  server.start(function() {
    console.log('Clock started');
  });
});
