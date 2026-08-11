const fs = require("fs");
const path = require("path");

function prepareRuntimeDatabase() {
  if (!process.env.VERCEL) {
    return;
  }

  const target = "/tmp/worknest.db";
  process.env.DATABASE_URL = `file:${target}`;

  if (fs.existsSync(target)) {
    return;
  }

  const candidates = [
    path.join(process.cwd(), "prisma", "deploy.db"),
    path.join(__dirname, "..", "..", "prisma", "deploy.db"),
  ];

  const bundled = candidates.find((candidate) => fs.existsSync(candidate));
  if (!bundled) {
    throw new Error(
      "Vercel database bundle missing (prisma/deploy.db). Check vercel-build."
    );
  }

  fs.copyFileSync(bundled, target);
}

module.exports = { prepareRuntimeDatabase };
