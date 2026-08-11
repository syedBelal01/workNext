const { Role } = require("../lib/constants");
const { serialize } = require("../lib/serialize");
const { User, Project, Task, AuditLog, toObjectIds } = require("../models");
const { getAccessibleProjectIds, isAdmin } = require("../lib/rbac");
const { asyncHandler } = require("../middleware/error");
const { paginationSchema } = require("../validators/schemas");

const listAuditLogs = asyncHandler(async (req, res) => {
  const query = paginationSchema.parse(req.query);

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.find()
      .populate({ path: "actorId", select: "name email role" })
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
  ]);

  const data = serialize(logs).map((log) => {
    if (log.actorId && typeof log.actorId === "object") {
      log.actor = log.actorId;
      log.actorId = log.actor.id;
    } else {
      log.actor = null;
    }
    return log;
  });

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
    accessible === "ALL" ? {} : { _id: { $in: toObjectIds(accessible) } };
  const taskFilter =
    accessible === "ALL"
      ? {}
      : { projectId: { $in: toObjectIds(accessible) } };

  const memberTaskFilter =
    req.user.role === Role.MEMBER
      ? { ...taskFilter, assigneeId: toObjectIds([req.user.id])[0] }
      : taskFilter;

  const [projectCount, tasks, usersByRoleRaw] = await Promise.all([
    Project.countDocuments(projectFilter),
    Task.find(memberTaskFilter)
      .populate({ path: "projectId", select: "name" })
      .populate({ path: "assigneeId", select: "name" })
      .sort({ updatedAt: -1 })
      .lean(),
    isAdmin(req.user)
      ? User.find().select("role").lean()
      : Promise.resolve([]),
  ]);

  const formattedTasks = serialize(tasks).map((task) => {
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
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      updatedAt: task.updatedAt,
      project: task.project || null,
      assignee: task.assignee || null,
    };
  });

  let openTasks = 0;
  let doneTasks = 0;
  for (const task of formattedTasks) {
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
        tasks: formattedTasks.length,
        openTasks,
        doneTasks,
      },
      recentTasks: formattedTasks.slice(0, 5),
      usersByRole: Array.from(roleMap.entries()).map(([role, count]) => ({
        role,
        count,
      })),
    },
  });
});

module.exports = { listAuditLogs, getDashboard };
