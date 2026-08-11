const { prepareRuntimeDatabase } = require("../src/lib/initDb");

prepareRuntimeDatabase();

const { createApp } = require("../src/app");

module.exports = createApp();
