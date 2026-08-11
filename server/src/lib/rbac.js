const { Role } = require("./constants");
const { AppError } = require("./errors");
const { prisma } = require("./prisma");

function isAdmin(user) {
  return user.role === Role.ADMIN;
}

function isManagerOrAbove(user) {
  return user.role === Role.ADMIN || user.role === Role.MANAGER;
}

async function getAccessibleProjectIds(user) {
  if (isAdmin(user)) {
    return "ALL";
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });

  const owned = await prisma.project.findMany({
    where: { ownerId: user.id },
    select: { id: true },
  });

  const ids = new Set();
  memberships.forEach((m) => ids.add(m.projectId));
  owned.forEach((p) => ids.add(p.id));
  return Array.from(ids);
}

async function assertCanAccessProject(user, projectId) {
  if (isAdmin(user)) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      members: { where: { userId: user.id }, select: { id: true } },
    },
  });

  if (!project) {
    throw new AppError(404, "Project not found");
  }

  const isOwner = project.ownerId === user.id;
  const isMember = project.members.length > 0;

  if (!isOwner && !isMember) {
    throw new AppError(403, "You do not have access to this project");
  }
}

async function assertCanManageProject(user, projectId) {
  if (isAdmin(user)) return;

  if (user.role !== Role.MANAGER) {
    throw new AppError(403, "Only managers and admins can manage projects");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  if (!project) {
    throw new AppError(404, "Project not found");
  }

  if (project.ownerId !== user.id) {
    throw new AppError(403, "You can only manage projects you own");
  }
}

async function assertCanMutateTask(user, task) {
  if (isAdmin(user)) return;

  if (user.role === Role.MANAGER) {
    await assertCanManageProject(user, task.projectId);
    return;
  }

  if (task.assigneeId !== user.id) {
    throw new AppError(403, "You can only update tasks assigned to you");
  }
}

module.exports = {
  isAdmin,
  isManagerOrAbove,
  getAccessibleProjectIds,
  assertCanAccessProject,
  assertCanManageProject,
  assertCanMutateTask,
};
