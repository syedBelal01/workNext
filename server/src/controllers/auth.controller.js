const bcrypt = require("bcryptjs");
const { writeAuditLog } = require("../lib/audit");
const { AppError } = require("../lib/errors");
const { User } = require("../models");
const { authenticate, signToken } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/error");
const { loginSchema } = require("../validators/schemas");

const login = asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await User.findOne({ email: body.email.toLowerCase() })
    .select("email name role isActive passwordHash")
    .lean();

  if (!user || !user.isActive) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const authUser = {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const token = signToken(authUser);

  void writeAuditLog({
    actorId: authUser.id,
    action: "AUTH_LOGIN",
    entityType: "User",
    entityId: authUser.id,
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
