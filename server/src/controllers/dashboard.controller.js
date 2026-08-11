const { Role } = require("../lib/constants");
const { prisma } = require("../lib/prisma");
const { getAccessibleProjectIds, isAdmin } = require("../lib/rbac");
const { asyncHandler } = require("../middleware/error");
const { paginationSchema } = require("../validators/schemas");

const listAuditLogs = asyncHandler(async (req, res) => {
  const query = paginationSchema.parse(req.query);

  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  const data = logs;

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

const getDashboard = asyncHandler(async (req, res) => {
  const accessible = await getAccessibleProjectIds(req.user);
  const projectFilter =
    accessible === "ALL" ? {} : { id: { in: accessible } };
  const taskFilter =
    accessible === "ALL" ? {} : { projectId: { in: accessible } };

  const memberTaskFilter =
    req.user.role === Role.MEMBER
      ? { ...taskFilter, assigneeId: req.user.id }
      : taskFilter;

  const [projectCount, taskCount, openTasks, doneTasks, recentTasks, allUsers] =
    await Promise.all([
      prisma.project.count({ where: projectFilter }),
      prisma.task.count({ where: memberTaskFilter }),
      prisma.task.count({
        where: {
          ...memberTaskFilter,
          status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED"] },
        },
      }),
      prisma.task.count({
        where: { ...memberTaskFilter, status: "DONE" },
      }),
      prisma.task.findMany({
        where: memberTaskFilter,
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      isAdmin(req.user)
        ? prisma.user.findMany({ select: { role: true } })
        : Promise.resolve([]),
    ]);

  const roleMap = new Map();
  allUsers.forEach((user) => {
    roleMap.set(user.role, (roleMap.get(user.role) ?? 0) + 1);
  });

  res.json({
    success: true,
    data: {
      counts: {
        projects: projectCount,
        tasks: taskCount,
        openTasks,
        doneTasks,
      },
      recentTasks,
      usersByRole: Array.from(roleMap.entries()).map(([role, count]) => ({
        role,
        count,
      })),
    },
  });
});

module.exports = { listAuditLogs, getDashboard };
