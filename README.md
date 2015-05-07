# hapi-job-queue
Hapi and MongoDB powered job queue.

[![Build Status](https://travis-ci.org/dawnerd/hapi-job-queue.svg?branch=master)](https://travis-ci.org/dawnerd/hapi-job-queue)
[![Coverage Status](https://coveralls.io/repos/dawnerd/hapi-job-queue/badge.svg?branch=master)](https://coveralls.io/r/dawnerd/hapi-job-queue?branch=master)


Features:

 - Utilizes server methods for jobs
 - Jobs can be grouped together by name
 - Jobs or groups can be run in intervals using the [later](http://bunkat.github.io/later/parsers.html#cron) cron and text syntax.
 - Optional JSON api to control jobs
 - Jobs contain tasks to run. By default a job has just one task with no data. Job will run once for each task.
