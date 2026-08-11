const bcrypt = require("bcryptjs");
const { Role } = require("../lib/constants");
const { writeAuditLog } = require("../lib/audit");
const { AppError } = require("../lib/errors");
const { serialize, contains } = require("../lib/serialize");
const {
  User,
  Project,
  ProjectMember,
  Task,
  AuditLog,
  toObjectId,
} = require("../models");
const { asyncHandler } = require("../middleware/error");
const {
  createUserSchema,
  paginationSchema,
  updateUserSchema,
} = require("../validators/schemas");

const publicFields = "email name role isActive createdAt updatedAt";

const listUsers = asyncHandler(async (req, res) => {
  const query = paginationSchema.parse(req.query);
  const filter = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.search
      ? {
          $or: [contains("name", query.search), contains("email", query.search)],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select(publicFields)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
  ]);

  res.json({
    success: true,
    data: serialize(users),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  });
});

const createUser = asyncHandler(async (req, res) => {
  const body = createUserSchema.parse(req.body);
  const email = body.email.toLowerCase();

  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) {
    throw new AppError(409, "A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await User.create({
    email,
    name: body.name,
    role: body.role,
    passwordHash,
  });

  const safe = serialize(
    await User.findById(user._id).select(publicFields).lean()
  );

  await writeAuditLog({
    req,
    action: "USER_CREATE",
    entityType: "User",
    entityId: safe.id,
    metadata: { email: safe.email, role: safe.role },
  });

  res.status(201).json({ success: true, data: safe });
});

const updateUser = asyncHandler(async (req, res) => {
  const body = updateUserSchema.parse(req.body);
  const { id } = req.params;

  const existing = await User.findById(id).lean();
  if (!existing) {
    throw new AppError(404, "User not found");
  }

  if (
    String(existing._id) === req.user.id &&
    ((body.role && body.role !== Role.ADMIN) || body.isActive === false)
  ) {
    throw new AppError(400, "You cannot demote or deactivate your own account");
  }

  const passwordHash = body.password
    ? await bcrypt.hash(body.password, 10)
    : undefined;

  const user = await User.findByIdAndUpdate(
    id,
    {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    { new: true }
  )
    .select(publicFields)
    .lean();

  await writeAuditLog({
    req,
    action: "USER_UPDATE",
    entityType: "User",
    entityId: String(user._id),
    metadata: body,
  });

  res.json({ success: true, data: serialize(user) });
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    throw new AppError(400, "You cannot delete your own account");
  }

  const existing = await User.findById(id).lean();
  if (!existing) {
    throw new AppError(404, "User not found");
  }

  const userId = toObjectId(id);
  const ownedProjects = await Project.find({ ownerId: userId })
    .select("_id")
    .lean();
  const ownedIds = ownedProjects.map((p) => p._id);

  await Task.deleteMany({
    $or: [{ createdById: userId }, { projectId: { $in: ownedIds } }],
  });
  await ProjectMember.deleteMany({
    $or: [{ userId }, { projectId: { $in: ownedIds } }],
  });
  await Project.deleteMany({ ownerId: userId });
  await Task.updateMany({ assigneeId: userId }, { $set: { assigneeId: null } });
  await AuditLog.updateMany({ actorId: userId }, { $set: { actorId: null } });
  await User.deleteOne({ _id: userId });

  await writeAuditLog({
    req,
    action: "USER_DELETE",
    entityType: "User",
    entityId: id,
    metadata: { email: existing.email },
  });

  res.json({ success: true, message: "User deleted" });
});

const listAssignableUsers = asyncHandler(async (_req, res) => {
  const users = await User.find({ isActive: true })
    .select("name email role")
    .sort({ name: 1 })
    .lean();

  res.json({ success: true, data: serialize(users) });
});

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listAssignableUsers,
};
