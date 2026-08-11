const { mongoose } = require("../db/connect");

const { Schema, Types } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: "MEMBER", index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "User" }
);

const projectSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: null },
    status: { type: String, default: "PLANNING", index: true },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true, collection: "Project" }
);

const projectMemberSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { collection: "ProjectMember" }
);

projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

const taskSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: null },
    status: { type: String, default: "TODO", index: true },
    priority: { type: String, default: "MEDIUM" },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true, collection: "Task" }
);

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: undefined },
    ipAddress: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "AuditLog", updatedAt: false }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Project =
  mongoose.models.Project || mongoose.model("Project", projectSchema);
const ProjectMember =
  mongoose.models.ProjectMember ||
  mongoose.model("ProjectMember", projectMemberSchema);
const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);
const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof Types.ObjectId) return id;
  return new Types.ObjectId(String(id));
}

function toObjectIds(ids = []) {
  return ids.filter(Boolean).map((id) => toObjectId(id));
}

module.exports = {
  User,
  Project,
  ProjectMember,
  Task,
  AuditLog,
  toObjectId,
  toObjectIds,
  Types,
};
