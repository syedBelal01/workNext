const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const { env } = require("./config/env");
const { errorHandler, notFoundHandler } = require("./middleware/error");
const routes = require("./routes");

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (env.clientOrigins.includes("*")) return true;
  if (env.clientOrigins.includes(origin)) return true;
  if (/\.vercel\.app$/i.test(origin)) return true;
  return false;
}

function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(compression());
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  if (!env.onVercel) {
    app.use(morgan(env.isTest ? "tiny" : "dev"));
  }

  app.use(
    "/api/auth/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: "Too many login attempts. Try again later.",
      },
    })
  );

  app.get("/", (_req, res) => {
    res.json({
      success: true,
      message: "WorkNest API",
      health: "/api/health",
    });
  });

  app.use("/api", routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
