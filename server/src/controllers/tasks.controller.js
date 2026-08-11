const { writeAuditLog } = require("../lib/audit");
const { Role } = require("../lib/constants");
const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
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

const taskInclude = {
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true, email: true } },
};

const listTasks = asyncHandler(async (req, res) => {
  const query = paginationSchema.parse(req.query);
  const isMember = req.user.role === Role.MEMBER;

  // Members only see tasks assigned to them (across projects they can access).
  if (isMember) {
    if (query.projectId) {
      await assertCanAccessProject(req.user, query.projectId);
    }
  }

  const accessible = isMember ? null : await getAccessibleProjectIds(req.user);

  const where = {
    ...(isMember
      ? { assigneeId: req.user.id }
      : accessible === "ALL"
        ? {}
        : { projectId: { in: accessible } }),
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(!isMember && query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search } },
            { description: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ updatedAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  res.json({
    success: true,
    data: tasks,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  });
});

const getTask = asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: taskInclude,
  });

  if (!task) {
    throw new AppError(404, "Task not found");
  }

  if (task.assigneeId !== req.user.id) {
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

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? "TODO",
      priority: body.priority ?? "MEDIUM",
      projectId,
      assigneeId:
        body.assigneeId ??
        (req.user.role === Role.MEMBER ? req.user.id : null),
      createdById: req.user.id,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
    include: taskInclude,
  });

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
  const existing = await prisma.task.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) {
    throw new AppError(404, "Task not found");
  }

  await assertCanMutateTask(req.user, existing);
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
    await ensureProjectMembership(existing.projectId, body.assigneeId);
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      assigneeId: body.assigneeId,
      dueDate:
        body.dueDate === undefined
          ? undefined
          : body.dueDate
            ? new Date(body.dueDate)
            : null,
    },
    include: taskInclude,
  });

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
  const existing = await prisma.task.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) {
    throw new AppError(404, "Task not found");
  }

  if (isAdmin(req.user)) {
    // ok
  } else if (req.user.role === Role.MANAGER) {
    await assertCanManageProject(req.user, existing.projectId);
  } else {
    throw new AppError(403, "Only managers and admins can delete tasks");
  }

  await prisma.task.delete({ where: { id: req.params.id } });

  await writeAuditLog({
    req,
    action: "TASK_DELETE",
    entityType: "Task",
    entityId: existing.id,
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
