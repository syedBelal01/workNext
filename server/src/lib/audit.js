const { prisma } = require("./prisma");

async function writeAuditLog(input) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? input.req?.user?.id ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.req?.ip ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

module.exports = { writeAuditLog };
