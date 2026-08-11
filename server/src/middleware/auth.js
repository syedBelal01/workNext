const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { AppError } = require("../lib/errors");

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    const token = header.slice(7);
    let payload;

    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new AppError(401, "Invalid or expired token");
    }

    if (!payload?.sub || !payload?.role) {
      throw new AppError(401, "Invalid token payload");
    }

    // Trust signed JWT claims — avoids a DB round-trip on every request
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name || "",
      role: payload.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError(401, "Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "You do not have permission for this action"));
    }

    next();
  };
}

module.exports = { signToken, authenticate, authorize };
