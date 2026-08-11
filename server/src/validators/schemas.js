const { z } = require("zod");
const { Role } = require("../lib/constants");

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(80),
  role: z.enum([Role.ADMIN, Role.MANAGER, Role.MEMBER]),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum([Role.ADMIN, Role.MANAGER, Role.MEMBER]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(72).optional(),
});

const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z
    .enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"])
    .optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  memberIds: z.array(z.string().min(1)).optional(),
});

const updateProjectSchema = projectSchema.partial();

const taskSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional().nullable(),
  status: z
    .enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().min(1).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

const updateTaskSchema = taskSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  role: z.enum([Role.ADMIN, Role.MANAGER, Role.MEMBER]).optional(),
});

module.exports = {
  loginSchema,
  createUserSchema,
  updateUserSchema,
  projectSchema,
  updateProjectSchema,
  taskSchema,
  updateTaskSchema,
  paginationSchema,
};
