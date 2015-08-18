#!/usr/bin/env node

"use strict";

var context = require('rabbit.js').createContext('amqp://localhost');

context.on('ready', function() {
  var pub = context.socket('PUSH');
  pub.connect('tiles', function() {
    pub.write(process.argv[2], 'utf8');
    setTimeout(function() {
        process.exit(0)
    }, 1);
  });
});
