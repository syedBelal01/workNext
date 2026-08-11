const { AuditLog, toObjectId } = require("../models");

async function writeAuditLog(input) {
  try {
    const actorRaw = input.actorId ?? input.req?.user?.id ?? null;
    await AuditLog.create({
      actorId: actorRaw ? toObjectId(actorRaw) : null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ? String(input.entityId) : null,
      metadata: input.metadata ?? undefined,
      ipAddress: input.req?.ip ?? null,
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

module.exports = { writeAuditLog };
