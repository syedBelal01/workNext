const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const dbFile = path.join(root, "prisma", "deploy.db");

process.env.DATABASE_URL = `file:${dbFile}`;

if (fs.existsSync(dbFile)) {
  fs.unlinkSync(dbFile);
}

console.log("Preparing SQLite bundle for Vercel...");
execSync("npx prisma generate", { cwd: root, stdio: "inherit" });
execSync("npx prisma db push", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
execSync("node prisma/seed.js", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

console.log("Created prisma/deploy.db");
