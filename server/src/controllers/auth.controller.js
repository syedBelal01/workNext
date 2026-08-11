const bcrypt = require("bcryptjs");
const { writeAuditLog } = require("../lib/audit");
const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
const { authenticate, signToken } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/error");
const { loginSchema } = require("../validators/schemas");

const login = asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      passwordHash: true,
    },
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

  // Don't block login response on audit write
  void writeAuditLog({
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
    res.json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        isActive: true,
      },
    });
  }),
];

const logout = [
  authenticate,
  asyncHandler(async (req, res) => {
    void writeAuditLog({
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
