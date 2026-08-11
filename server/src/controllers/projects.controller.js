const { writeAuditLog } = require("../lib/audit");
const { Role } = require("../lib/constants");
const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
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

const projectInclude = {
  owner: { select: { id: true, name: true, email: true, role: true } },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  _count: { select: { tasks: true } },
};

const listProjects = asyncHandler(async (req, res) => {
  const query = paginationSchema.parse(req.query);
  const accessible = await getAccessibleProjectIds(req.user);

  const where = {
    ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search } },
            { description: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  res.json({
    success: true,
    data: projects,
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

  const memberOnlyAssigned = req.user.role === Role.MEMBER;

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      ...projectInclude,
      tasks: {
        where: memberOnlyAssigned ? { assigneeId: req.user.id } : undefined,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!project) {
    throw new AppError(404, "Project not found");
  }

  res.json({ success: true, data: project });
});

const createProject = asyncHandler(async (req, res) => {
  if (!isManagerOrAbove(req.user)) {
    throw new AppError(403, "Only managers and admins can create projects");
  }

  const body = projectSchema.parse(req.body);

  const creator = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, isActive: true },
  });

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
    ? await prisma.user.findMany({
        where: { id: { in: requestedMemberIds }, isActive: true },
        select: { id: true },
      })
    : [];

  if (selectedUsers.length !== requestedMemberIds.length) {
    throw new AppError(
      400,
      "One or more selected members are invalid. Close the form and try again."
    );
  }

  const memberIds = Array.from(
    new Set([creator.id, ...selectedUsers.map((user) => user.id)])
  );

  const project = await prisma.project.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      status: body.status ?? "PLANNING",
      ownerId: creator.id,
      startDate: body.startDate ? new Date(body.startDate) : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      members: {
        create: memberIds.map((userId) => ({ userId })),
      },
    },
    include: projectInclude,
  });

  void writeAuditLog({
    req,
    action: "PROJECT_CREATE",
    entityType: "Project",
    entityId: project.id,
    metadata: { name: project.name },
  });

  res.status(201).json({ success: true, data: project });
});

const updateProject = asyncHandler(async (req, res) => {
  await assertCanManageProject(req.user, req.params.id);
  const body = updateProjectSchema.parse(req.body);

  if (body.memberIds) {
    const users = await prisma.user.findMany({
      where: { id: { in: body.memberIds }, isActive: true },
      select: { id: true },
    });
    if (users.length !== body.memberIds.length) {
      throw new AppError(400, "One or more members are invalid");
    }

    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { ownerId: true },
    });
    if (!project) throw new AppError(404, "Project not found");

    const nextMembers = Array.from(
      new Set([...body.memberIds, project.ownerId])
    );

    await prisma.$transaction([
      prisma.projectMember.deleteMany({ where: { projectId: req.params.id } }),
      prisma.projectMember.createMany({
        data: nextMembers.map((userId) => ({
          projectId: req.params.id,
          userId,
        })),
      }),
    ]);
  }

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      name: body.name,
      description: body.description,
      status: body.status,
      startDate:
        body.startDate === undefined
          ? undefined
          : body.startDate
            ? new Date(body.startDate)
            : null,
      dueDate:
        body.dueDate === undefined
          ? undefined
          : body.dueDate
            ? new Date(body.dueDate)
            : null,
    },
    include: projectInclude,
  });

  await writeAuditLog({
    req,
    action: "PROJECT_UPDATE",
    entityType: "Project",
    entityId: project.id,
    metadata: body,
  });

  res.json({ success: true, data: project });
});

const deleteProject = asyncHandler(async (req, res) => {
  if (isAdmin(req.user)) {
    const exists = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true },
    });
    if (!exists) throw new AppError(404, "Project not found");
  } else {
    await assertCanManageProject(req.user, req.params.id);
  }

  const projectId = req.params.id;
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!existing) throw new AppError(404, "Project not found");

  await prisma.$transaction([
    prisma.task.deleteMany({ where: { projectId } }),
    prisma.projectMember.deleteMany({ where: { projectId } }),
    prisma.project.delete({ where: { id: projectId } }),
  ]);

  await writeAuditLog({
    req,
    action: "PROJECT_DELETE",
    entityType: "Project",
    entityId: existing.id,
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
