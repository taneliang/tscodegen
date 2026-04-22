#!/usr/bin/env node
"use strict";

const { main } = require("../dist/cli/verifyCodelock");

process.exitCode = main(process.argv.slice(2));
