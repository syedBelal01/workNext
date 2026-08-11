const { writeAuditLog } = require("../lib/audit");
const { Role } = require("../lib/constants");
const { AppError } = require("../lib/errors");
const { serialize, contains } = require("../lib/serialize");
const { Task, toObjectId, toObjectIds } = require("../models");
const {
  assertCanAccessProject,
  assertCanManageProject,
  assertCanMutateTask,
  ensureProjectMembership,
  getAccessibleProjectIds,
  isAdmin,
} = require("../lib/rbac");
const { asyncHandler } = require("../middleware/error");
const {
  paginationSchema,
  taskSchema,
  updateTaskSchema,
} = require("../validators/schemas");

async function loadTask(id) {
  return Task.findById(id)
    .populate({ path: "projectId", select: "name" })
    .populate({ path: "assigneeId", select: "name email role" })
    .populate({ path: "createdById", select: "name email" })
    .lean();
}

function formatTask(taskDoc) {
  const task = serialize(taskDoc);
  if (task.projectId && typeof task.projectId === "object") {
    task.project = task.projectId;
    task.projectId = task.project.id;
  }
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
}

const listTasks = asyncHandler(async (req, res) => {
  const query = paginationSchema.parse(req.query);
  const isMember = req.user.role === Role.MEMBER;

  if (isMember && query.projectId) {
    await assertCanAccessProject(req.user, query.projectId);
  }

  const accessible = isMember ? null : await getAccessibleProjectIds(req.user);

  const filter = {
    ...(isMember
      ? { assigneeId: toObjectId(req.user.id) }
      : accessible === "ALL"
        ? {}
        : { projectId: { $in: toObjectIds(accessible) } }),
    ...(query.projectId ? { projectId: toObjectId(query.projectId) } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(!isMember && query.assigneeId
      ? { assigneeId: toObjectId(query.assigneeId) }
      : {}),
    ...(query.search
      ? {
          $or: [
            contains("title", query.search),
            contains("description", query.search),
          ],
        }
      : {}),
  };

  const [total, tasks] = await Promise.all([
    Task.countDocuments(filter),
    Task.find(filter)
      .populate({ path: "projectId", select: "name" })
      .populate({ path: "assigneeId", select: "name email role" })
      .populate({ path: "createdById", select: "name email" })
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
  ]);

  res.json({
    success: true,
    data: tasks.map(formatTask),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  });
});

const getTask = asyncHandler(async (req, res) => {
  const taskDoc = await loadTask(req.params.id);
  if (!taskDoc) {
    throw new AppError(404, "Task not found");
  }

  const task = formatTask(taskDoc);
  if (String(task.assigneeId || "") !== String(req.user.id)) {
    await assertCanAccessProject(req.user, task.projectId);
  }
  res.json({ success: true, data: task });
});

const createTask = asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await assertCanAccessProject(req.user, projectId);

  const body = taskSchema.parse(req.body);

  if (req.user.role === Role.MEMBER) {
    if (body.assigneeId && body.assigneeId !== req.user.id) {
      throw new AppError(403, "Members can only assign tasks to themselves");
    }
  } else if (isAdmin(req.user)) {
    // full access
  } else if (req.user.role === Role.MANAGER) {
    await assertCanManageProject(req.user, projectId);
  } else {
    throw new AppError(403, "You cannot create tasks");
  }

  if (body.assigneeId) {
    await ensureProjectMembership(projectId, body.assigneeId);
  }

  const assigneeId =
    body.assigneeId ??
    (req.user.role === Role.MEMBER ? req.user.id : null);

  const created = await Task.create({
    title: body.title,
    description: body.description ?? null,
    status: body.status ?? "TODO",
    priority: body.priority ?? "MEDIUM",
    projectId: toObjectId(projectId),
    assigneeId: assigneeId ? toObjectId(assigneeId) : null,
    createdById: toObjectId(req.user.id),
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
  });

  const task = formatTask(await loadTask(created._id));

  await writeAuditLog({
    req,
    action: "TASK_CREATE",
    entityType: "Task",
    entityId: task.id,
    metadata: { title: task.title, projectId },
  });

  res.status(201).json({ success: true, data: task });
});

const updateTask = asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id).lean();
  if (!existing) {
    throw new AppError(404, "Task not found");
  }

  const existingForRbac = {
    ...existing,
    id: String(existing._id),
    projectId: String(existing.projectId),
    assigneeId: existing.assigneeId ? String(existing.assigneeId) : null,
  };

  await assertCanMutateTask(req.user, existingForRbac);
  const body = updateTaskSchema.parse(req.body);

  if (req.user.role === Role.MEMBER) {
    if (
      body.assigneeId !== undefined ||
      body.priority !== undefined ||
      body.title !== undefined
    ) {
      throw new AppError(
        403,
        "Members can only update status and description on assigned tasks"
      );
    }
  }

  if (body.assigneeId) {
    await ensureProjectMembership(existingForRbac.projectId, body.assigneeId);
  }

  await Task.findByIdAndUpdate(req.params.id, {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.description !== undefined
      ? { description: body.description }
      : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.priority !== undefined ? { priority: body.priority } : {}),
    ...(body.assigneeId !== undefined
      ? {
          assigneeId: body.assigneeId ? toObjectId(body.assigneeId) : null,
        }
      : {}),
    ...(body.dueDate !== undefined
      ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
      : {}),
  });

  const task = formatTask(await loadTask(req.params.id));

  await writeAuditLog({
    req,
    action: "TASK_UPDATE",
    entityType: "Task",
    entityId: task.id,
    metadata: body,
  });

  res.json({ success: true, data: task });
});

const deleteTask = asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id).lean();
  if (!existing) {
    throw new AppError(404, "Task not found");
  }

  if (isAdmin(req.user)) {
    // ok
  } else if (req.user.role === Role.MANAGER) {
    await assertCanManageProject(req.user, String(existing.projectId));
  } else {
    throw new AppError(403, "Only managers and admins can delete tasks");
  }

  await Task.deleteOne({ _id: existing._id });

  await writeAuditLog({
    req,
    action: "TASK_DELETE",
    entityType: "Task",
    entityId: String(existing._id),
    metadata: { title: existing.title },
  });

  res.json({ success: true, message: "Task deleted" });
});

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
};
