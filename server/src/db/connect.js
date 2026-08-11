const mongoose = require("mongoose");
const { env } = require("../config/env");

const globalForDb = globalThis;

async function connectDb() {
  if (globalForDb.__worknestDb?.readyState === 1) {
    return globalForDb.__worknestDb;
  }

  mongoose.set("strictQuery", true);

  const conn = await mongoose.connect(env.databaseUrl, {
    serverSelectionTimeoutMS: 10000,
  });

  globalForDb.__worknestDb = conn.connection;
  return conn.connection;
}

module.exports = { connectDb, mongoose };
