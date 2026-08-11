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

  res.json({
    success: true,
    data: logs,
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

  // Prefer fewer round-trips: load compact task rows once and derive counts
  const [projectCount, tasks, usersByRoleRaw] = await Promise.all([
    prisma.project.count({ where: projectFilter }),
    prisma.task.findMany({
      where: memberTaskFilter,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    isAdmin(req.user)
      ? prisma.user.findMany({ select: { role: true } })
      : Promise.resolve([]),
  ]);

  let openTasks = 0;
  let doneTasks = 0;
  for (const task of tasks) {
    if (task.status === "DONE") doneTasks += 1;
    else openTasks += 1;
  }

  const roleMap = new Map();
  usersByRoleRaw.forEach((user) => {
    roleMap.set(user.role, (roleMap.get(user.role) || 0) + 1);
  });

  res.json({
    success: true,
    data: {
      counts: {
        projects: projectCount,
        tasks: tasks.length,
        openTasks,
        doneTasks,
      },
      recentTasks: tasks.slice(0, 5),
      usersByRole: Array.from(roleMap.entries()).map(([role, count]) => ({
        role,
        count,
      })),
    },
  });
});

module.exports = { listAuditLogs, getDashboard };
