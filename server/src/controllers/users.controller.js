const bcrypt = require("bcryptjs");
const { Role } = require("../lib/constants");
const { writeAuditLog } = require("../lib/audit");
const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
const { asyncHandler } = require("../middleware/error");
const {
  createUserSchema,
  paginationSchema,
  updateUserSchema,
} = require("../validators/schemas");

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

function containsSearch(search) {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search } },
      { email: { contains: search } },
    ],
  };
}

const listUsers = asyncHandler(async (req, res) => {
  const query = paginationSchema.parse(req.query);
  const where = {
    ...containsSearch(query.search),
    ...(query.role ? { role: query.role } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  res.json({
    success: true,
    data: users,
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: body.name,
      role: body.role,
      passwordHash,
    },
    select: publicUserSelect,
  });

  await writeAuditLog({
    req,
    action: "USER_CREATE",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
  });

  res.status(201).json({ success: true, data: user });
});

const updateUser = asyncHandler(async (req, res) => {
  const body = updateUserSchema.parse(req.body);
  const { id } = req.params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "User not found");
  }

  if (
    existing.id === req.user.id &&
    ((body.role && body.role !== Role.ADMIN) || body.isActive === false)
  ) {
    throw new AppError(400, "You cannot demote or deactivate your own account");
  }

  const passwordHash = body.password
    ? await bcrypt.hash(body.password, 12)
    : undefined;

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: body.name,
      role: body.role,
      isActive: body.isActive,
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: publicUserSelect,
  });

  await writeAuditLog({
    req,
    action: "USER_UPDATE",
    entityType: "User",
    entityId: user.id,
    metadata: body,
  });

  res.json({ success: true, data: user });
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    throw new AppError(400, "You cannot delete your own account");
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "User not found");
  }

  await prisma.user.delete({ where: { id } });

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
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  res.json({ success: true, data: users });
});

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listAssignableUsers,
};
