const { writeAuditLog } = require("../lib/audit");
const { Role } = require("../lib/constants");
const { AppError } = require("../lib/errors");
const { serialize, contains } = require("../lib/serialize");
const {
  User,
  Project,
  ProjectMember,
  Task,
  toObjectId,
  toObjectIds,
} = require("../models");
const {
  assertCanAccessProject,
  assertCanManageProject,
  getAccessibleProjectIds,
  isAdmin,
  isManagerOrAbove,
} = require("../lib/rbac");
const { asyncHandler } = require("../middleware/error");
const {
  paginationSchema,
  projectSchema,
  updateProjectSchema,
} = require("../validators/schemas");

async function loadMembers(projectId) {
  const members = await ProjectMember.find({ projectId: toObjectId(projectId) })
    .populate({ path: "userId", select: "name email role" })
    .lean();

  return serialize(members).map((member) => {
    const user =
      member.userId && typeof member.userId === "object"
        ? member.userId
        : null;
    return {
      id: member.id,
      projectId: String(member.projectId),
      userId: user ? user.id : String(member.userId),
      joinedAt: member.joinedAt,
      user,
    };
  });
}

async function formatProject(projectDoc, { withTasks = false, assigneeOnlyId = null } = {}) {
  const project = serialize(projectDoc);
  if (project.ownerId && typeof project.ownerId === "object") {
    project.owner = project.ownerId;
    project.ownerId = project.owner.id;
  }

  const [members, taskCount, tasks] = await Promise.all([
    loadMembers(project.id),
    Task.countDocuments({ projectId: toObjectId(project.id) }),
    withTasks
      ? Task.find({
          projectId: toObjectId(project.id),
          ...(assigneeOnlyId
            ? { assigneeId: toObjectId(assigneeOnlyId) }
            : {}),
        })
          .populate({ path: "assigneeId", select: "name email" })
          .populate({ path: "createdById", select: "name" })
          .sort({ updatedAt: -1 })
          .lean()
      : Promise.resolve(null),
  ]);

  project.members = members;
  project._count = { tasks: taskCount };

  if (tasks) {
    project.tasks = serialize(tasks).map((task) => {
      if (task.assigneeId && typeof task.assigneeId === "object") {
        task.assignee = task.assigneeId;
        task.assigneeId = task.assignee.id;
      } else {
        task.assignee = null;
      }
      if (task.createdById && typeof task.createdById === "object") {
        task.createdBy = task.createdById;
        task.createdById = task.createdBy.id;
      }
      return task;
    });
  }

  return project;
}

const listProjects = asyncHandler(async (req, res) => {
  const query = paginationSchema.parse(req.query);
  const accessible = await getAccessibleProjectIds(req.user);

  const filter = {
    ...(accessible === "ALL" ? {} : { _id: { $in: toObjectIds(accessible) } }),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          $or: [
            contains("name", query.search),
            contains("description", query.search),
          ],
        }
      : {}),
  };

  const [total, projects] = await Promise.all([
    Project.countDocuments(filter),
    Project.find(filter)
      .populate({ path: "ownerId", select: "name email role" })
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
  ]);

  const data = await Promise.all(projects.map((p) => formatProject(p)));

  res.json({
    success: true,
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  });
});

const getProject = asyncHandler(async (req, res) => {
  await assertCanAccessProject(req.user, req.params.id);

  const project = await Project.findById(req.params.id)
    .populate({ path: "ownerId", select: "name email role" })
    .lean();

  if (!project) {
    throw new AppError(404, "Project not found");
  }

  const memberOnlyAssigned = req.user.role === Role.MEMBER;
  const data = await formatProject(project, {
    withTasks: true,
    assigneeOnlyId: memberOnlyAssigned ? req.user.id : null,
  });

  res.json({ success: true, data });
});

const createProject = asyncHandler(async (req, res) => {
  if (!isManagerOrAbove(req.user)) {
    throw new AppError(403, "Only managers and admins can create projects");
  }

  const body = projectSchema.parse(req.body);

  const creator = await User.findById(req.user.id)
    .select("isActive")
    .lean();

  if (!creator?.isActive) {
    throw new AppError(
      401,
      "Session expired. Please sign out and sign in again."
    );
  }

  const requestedMemberIds = Array.from(
    new Set((body.memberIds || []).filter(Boolean))
  );

  const selectedUsers = requestedMemberIds.length
    ? await User.find({
        _id: { $in: toObjectIds(requestedMemberIds) },
        isActive: true,
      })
        .select("_id")
        .lean()
    : [];

  if (selectedUsers.length !== requestedMemberIds.length) {
    throw new AppError(
      400,
      "One or more selected members are invalid. Close the form and try again."
    );
  }

  const memberIds = Array.from(
    new Set([
      String(creator._id),
      ...selectedUsers.map((user) => String(user._id)),
    ])
  );

  const created = await Project.create({
    name: body.name,
    description: body.description ?? null,
    status: body.status ?? "PLANNING",
    ownerId: creator._id,
    startDate: body.startDate ? new Date(body.startDate) : null,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
  });

  await ProjectMember.insertMany(
    memberIds.map((userId) => ({
      projectId: created._id,
      userId: toObjectId(userId),
    }))
  );

  const project = await Project.findById(created._id)
    .populate({ path: "ownerId", select: "name email role" })
    .lean();

  const data = await formatProject(project);

  void writeAuditLog({
    req,
    action: "PROJECT_CREATE",
    entityType: "Project",
    entityId: data.id,
    metadata: { name: data.name },
  });

  res.status(201).json({ success: true, data });
});

const updateProject = asyncHandler(async (req, res) => {
  await assertCanManageProject(req.user, req.params.id);
  const body = updateProjectSchema.parse(req.body);

  if (body.memberIds) {
    const users = await User.find({
      _id: { $in: toObjectIds(body.memberIds) },
      isActive: true,
    })
      .select("_id")
      .lean();
    if (users.length !== body.memberIds.length) {
      throw new AppError(400, "One or more members are invalid");
    }

    const project = await Project.findById(req.params.id)
      .select("ownerId")
      .lean();
    if (!project) throw new AppError(404, "Project not found");

    const nextMembers = Array.from(
      new Set([...body.memberIds.map(String), String(project.ownerId)])
    );

    await ProjectMember.deleteMany({ projectId: toObjectId(req.params.id) });
    await ProjectMember.insertMany(
      nextMembers.map((userId) => ({
        projectId: toObjectId(req.params.id),
        userId: toObjectId(userId),
      }))
    );
  }

  const updated = await Project.findByIdAndUpdate(
    req.params.id,
    {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.startDate !== undefined
        ? { startDate: body.startDate ? new Date(body.startDate) : null }
        : {}),
      ...(body.dueDate !== undefined
        ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
        : {}),
    },
    { new: true }
  )
    .populate({ path: "ownerId", select: "name email role" })
    .lean();

  if (!updated) throw new AppError(404, "Project not found");

  const data = await formatProject(updated);

  await writeAuditLog({
    req,
    action: "PROJECT_UPDATE",
    entityType: "Project",
    entityId: data.id,
    metadata: body,
  });

  res.json({ success: true, data });
});

const deleteProject = asyncHandler(async (req, res) => {
  if (isAdmin(req.user)) {
    const exists = await Project.findById(req.params.id).select("name").lean();
    if (!exists) throw new AppError(404, "Project not found");
  } else {
    await assertCanManageProject(req.user, req.params.id);
  }

  const projectId = toObjectId(req.params.id);
  const existing = await Project.findById(projectId).select("name").lean();
  if (!existing) throw new AppError(404, "Project not found");

  await Task.deleteMany({ projectId });
  await ProjectMember.deleteMany({ projectId });
  await Project.deleteOne({ _id: projectId });

  await writeAuditLog({
    req,
    action: "PROJECT_DELETE",
    entityType: "Project",
    entityId: String(existing._id),
    metadata: { name: existing.name },
  });

  res.json({ success: true, message: "Project deleted" });
});

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
};
