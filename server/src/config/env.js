require("dotenv").config();

function requireEnv(key, fallback) {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

const onVercel = Boolean(process.env.VERCEL);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  databaseUrl: requireEnv(
    "DATABASE_URL",
    onVercel ? "file:/tmp/worknest.db" : undefined
  ),
  jwtSecret: requireEnv(
    "JWT_SECRET",
    onVercel ? "worknest-vercel-demo-secret-change-me" : undefined
  ),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  isTest: process.env.NODE_ENV === "test",
  onVercel,
};

module.exports = { env };
