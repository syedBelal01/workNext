const { Role } = require("./constants");
const { AppError } = require("./errors");
const {
  User,
  Project,
  ProjectMember,
  Task,
  toObjectId,
} = require("../models");

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

  const userId = toObjectId(user.id);

  const [memberships, owned, assigned] = await Promise.all([
    ProjectMember.find({ userId }).select("projectId").lean(),
    Project.find({ ownerId: userId }).select("_id").lean(),
    Task.find({ assigneeId: userId }).select("projectId").lean(),
  ]);

  const ids = new Set();
  memberships.forEach((m) => ids.add(String(m.projectId)));
  owned.forEach((p) => ids.add(String(p._id)));
  assigned.forEach((t) => ids.add(String(t.projectId)));
  return Array.from(ids);
}

async function assertCanAccessProject(user, projectId) {
  if (isAdmin(user)) return;

  const project = await Project.findById(projectId).select("ownerId").lean();
  if (!project) {
    throw new AppError(404, "Project not found");
  }

  const userId = toObjectId(user.id);
  const isOwner = String(project.ownerId) === String(user.id);

  const [member, assignedTask] = await Promise.all([
    ProjectMember.findOne({
      projectId: project._id,
      userId,
    })
      .select("_id")
      .lean(),
    Task.findOne({ projectId: project._id, assigneeId: userId })
      .select("_id")
      .lean(),
  ]);

  if (!isOwner && !member && !assignedTask) {
    throw new AppError(403, "You do not have access to this project");
  }
}

async function assertCanManageProject(user, projectId) {
  if (isAdmin(user)) return;

  if (user.role !== Role.MANAGER) {
    throw new AppError(403, "Only managers and admins can manage projects");
  }

  const project = await Project.findById(projectId).select("ownerId").lean();
  if (!project) {
    throw new AppError(404, "Project not found");
  }

  if (String(project.ownerId) !== String(user.id)) {
    throw new AppError(403, "You can only manage projects you own");
  }
}

async function assertCanMutateTask(user, task) {
  if (isAdmin(user)) return;

  if (user.role === Role.MANAGER) {
    await assertCanManageProject(user, task.projectId);
    return;
  }

  if (String(task.assigneeId || "") !== String(user.id)) {
    throw new AppError(403, "You can only update tasks assigned to you");
  }
}

async function ensureProjectMembership(projectId, userId) {
  if (!userId) return;

  const user = await User.findById(userId).select("_id").lean();
  if (!user) {
    throw new AppError(400, "Assignee user was not found");
  }

  await ProjectMember.updateOne(
    { projectId: toObjectId(projectId), userId: toObjectId(userId) },
    {
      $setOnInsert: {
        projectId: toObjectId(projectId),
        userId: toObjectId(userId),
        joinedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

module.exports = {
  isAdmin,
  isManagerOrAbove,
  getAccessibleProjectIds,
  assertCanAccessProject,
  assertCanManageProject,
  assertCanMutateTask,
  ensureProjectMembership,
};
