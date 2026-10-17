#!/usr/bin/env node
'use strict';

const { run } = require('../lib/wc-lite.js');

process.exitCode = run(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
});
