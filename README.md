# hapi-job-queue
Hapi and MongoDB powered job queue.

[![Build Status](https://travis-ci.org/firstandthird/hapi-job-queue.svg?branch=master)](https://travis-ci.org/firstandthird/hapi-job-queue)
[![Coverage Status](https://coveralls.io/repos/firstandthird/hapi-job-queue/badge.svg?branch=master)](https://coveralls.io/r/firstandthird/hapi-job-queue?branch=master)


### Features:

 - Utilizes server methods for jobs
 - Jobs can be grouped together by name
 - Jobs or groups can be run in intervals using the [later](http://bunkat.github.io/later/parsers.html#cron) cron and text syntax.
 - Optional JSON api to control jobs
 - Jobs contain tasks to run. By default a job has just one task with no data. Job will run once for each task.

### Install:

```
npm install hapi-job-queue --save
```

### Usage:

```js
var server = new Hapi.Server();
var mongoUrl = 'mongodb://localhost:27017/something';

server.connection({port: 3000});

server.method('emailUsers', function(data, done) {
  server.plugins.emailService.spam(data.group, done);
});

server.register([
  { register: require('hapi-job-queue'), options: {
    connectionUrl: mongoUrl,
    endpoint: '',
    jobs: [
      {
        name: 'email-users',
        enabled: true,
        schedule: 'on the last day of the month',
        method: 'emailUsers', //server method
        tasks: [ // each task will run 'emailUsers' with the task as the data property
          {
            group: 'pendingUsers'
          },
          {
            group: 'approvedUsers'
          },
          {
            group: 'newsletterUsers'
          }
        ]
      }
    ]
  } }
], function() {
  // server start etc...
});
```

#### Options:

 - `connectionUrl` - mongodb connection url
 - `endpoint` - Path for api endpoint. Set to false to disable. No trailing slash. (default: false)
 - `auth` - Auth strategy to use for api endpoints. (default: false)
 - `concurrentTasks` - Number of instances of `method` that can run simultaneously. Note: This is limited on a per job basis. Two jobs running at the same time will each have a max of `concurrentTasks`. (default: 5)
 - `collection` - DB collection to use. (default: Jobs)
 - `verbose` - Extra logging. Tagged `hapi-job-queue, info`. (default: true)
 - `jobs` - Array of job objects.
  - `name` - Name of the job. Used in api endpoints and methods.
  - `enabled` - Enables or disables a job.
  - `single` - Set to true if this job will be manually run and not on a timer. (default false)
  - `schedule` - (optional) [Later](http://bunkat.github.io/later/parsers.html) style time definition.
  - `cron` - (optional) [Later](http://bunkat.github.io/later/parsers.html) style cron definition.
  - `cronSeconds` - (optional) Use if the above cron setting is in seconds.
  - `method` - Method to run for each task or once when no tasks are assigned. Can be a hapi server method or a function. `function(data, callback)`
  - `tasks` - (optional) Array of data to be passed to job method. Each item in the array will spawn an instance of `method`.

#### Methods:

These methods can be found in `server.plugins.jobs`.

 - `addJob` - params: `job`, `callback(err)` - Adds a job. Uses same job format as options.
 - `getJobs` - params: `callback(err)` - Returns all jobs
 - `enableJob` - params: `jobName`, `callback(err)` - Enables a job.
 - `disableJob` - params: `jobName`, `callback(err)` - Disables a job.
 - `runSingle` - params: `jobName`, `tasks`, `callback(err)` - Runs a single job. Tasks uses the same task format in options.

#### API

If you enable the web api these endpoints will be exposed.

 - `GET /` - Returns all jobs.
 - `GET /enable/{jobName}` - Enables a job
 - `GET /disable/{jobName}` - Disables a job
 - `POST /run/{jobName}` - Runs a job. Accepts a json payload of task data.
