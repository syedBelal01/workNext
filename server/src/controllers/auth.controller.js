const bcrypt = require("bcryptjs");
const { writeAuditLog } = require("../lib/audit");
const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
const { authenticate, signToken } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/error");
const { loginSchema } = require("../validators/schemas");

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
};

const login = asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const authUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const token = signToken(authUser);

  await writeAuditLog({
    actorId: user.id,
    action: "AUTH_LOGIN",
    entityType: "User",
    entityId: user.id,
    req,
  });

  res.json({
    success: true,
    data: {
      token,
      user: authUser,
    },
  });
});

const me = [
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: publicUserSelect,
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    res.json({ success: true, data: user });
  }),
];

const logout = [
  authenticate,
  asyncHandler(async (req, res) => {
    await writeAuditLog({
      actorId: req.user.id,
      action: "AUTH_LOGOUT",
      entityType: "User",
      entityId: req.user.id,
      req,
    });

    res.json({ success: true, message: "Logged out" });
  }),
];

module.exports = { login, me, logout };
