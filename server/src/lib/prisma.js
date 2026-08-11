const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const prisma = globalForPrisma.prisma || createPrismaClient();
globalForPrisma.prisma = prisma;

module.exports = { prisma };
