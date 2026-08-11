const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const dashboardController = require("../controllers/dashboard.controller");
const projectsController = require("../controllers/projects.controller");
const tasksController = require("../controllers/tasks.controller");
const usersController = require("../controllers/users.controller");
const { Role } = require("../lib/constants");
const { authenticate, authorize } = require("../middleware/auth");

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, message: "WorkNest API is running" });
});

router.post("/auth/login", authController.login);
router.get("/auth/me", ...authController.me);
router.post("/auth/logout", ...authController.logout);

router.use(authenticate);

router.get("/dashboard", dashboardController.getDashboard);

router.get(
  "/users/assignable",
  authorize(Role.ADMIN, Role.MANAGER),
  usersController.listAssignableUsers
);
router.get("/users", authorize(Role.ADMIN), usersController.listUsers);
router.post("/users", authorize(Role.ADMIN), usersController.createUser);
router.patch("/users/:id", authorize(Role.ADMIN), usersController.updateUser);
router.delete("/users/:id", authorize(Role.ADMIN), usersController.deleteUser);

router.get("/projects", projectsController.listProjects);
router.get("/projects/:id", projectsController.getProject);
router.post(
  "/projects",
  authorize(Role.ADMIN, Role.MANAGER),
  projectsController.createProject
);
router.patch(
  "/projects/:id",
  authorize(Role.ADMIN, Role.MANAGER),
  projectsController.updateProject
);
router.delete(
  "/projects/:id",
  authorize(Role.ADMIN, Role.MANAGER),
  projectsController.deleteProject
);

router.get("/tasks", tasksController.listTasks);
router.get("/tasks/:id", tasksController.getTask);
router.post("/projects/:projectId/tasks", tasksController.createTask);
router.patch("/tasks/:id", tasksController.updateTask);
router.delete(
  "/tasks/:id",
  authorize(Role.ADMIN, Role.MANAGER),
  tasksController.deleteTask
);

router.get(
  "/audit-logs",
  authorize(Role.ADMIN),
  dashboardController.listAuditLogs
);

module.exports = router;
