const bcrypt = require("bcryptjs");
const { connectDb } = require("./src/db/connect");
const { Role, TaskPriority, TaskStatus } = require("./src/lib/constants");
const {
  User,
  Project,
  ProjectMember,
  Task,
  AuditLog,
} = require("./src/models");

async function main() {
  await connectDb();

  await AuditLog.deleteMany({});
  await Task.deleteMany({});
  await ProjectMember.deleteMany({});
  await Project.deleteMany({});
  await User.deleteMany({});

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const [admin, manager, member, memberTwo] = await User.create([
    {
      email: "admin@worknest.local",
      name: "Aisha Khan",
      role: Role.ADMIN,
      passwordHash,
    },
    {
      email: "manager@worknest.local",
      name: "Rahul Mehta",
      role: Role.MANAGER,
      passwordHash,
    },
    {
      email: "member@worknest.local",
      name: "Sara Ali",
      role: Role.MEMBER,
      passwordHash,
    },
    {
      email: "dev@worknest.local",
      name: "Omar Farid",
      role: Role.MEMBER,
      passwordHash,
    },
  ]);

  const project = await Project.create({
    name: "Customer Portal Revamp",
    description:
      "Rebuild the customer portal with improved UX, SSO, and reporting.",
    status: "ACTIVE",
    ownerId: manager._id,
    startDate: new Date(),
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
  });

  await ProjectMember.insertMany([
    { projectId: project._id, userId: manager._id },
    { projectId: project._id, userId: member._id },
    { projectId: project._id, userId: memberTwo._id },
  ]);

  await Task.insertMany([
    {
      title: "Map current portal workflows",
      description: "Document existing user journeys and pain points.",
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      projectId: project._id,
      assigneeId: member._id,
      createdById: manager._id,
    },
    {
      title: "Design dashboard wireframes",
      description: "Produce low-fidelity screens for the new dashboard.",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      projectId: project._id,
      assigneeId: memberTwo._id,
      createdById: manager._id,
    },
    {
      title: "Implement SSO handshake",
      description: "Integrate OIDC login against the identity provider.",
      status: TaskStatus.TODO,
      priority: TaskPriority.URGENT,
      projectId: project._id,
      assigneeId: member._id,
      createdById: manager._id,
    },
    {
      title: "Stakeholder review checkpoint",
      description: "Collect feedback from sales and support leads.",
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      projectId: project._id,
      assigneeId: manager._id,
      createdById: admin._id,
    },
  ]);

  await AuditLog.create({
    actorId: admin._id,
    action: "SEED_COMPLETE",
    entityType: "System",
    metadata: { users: 4, projects: 1 },
  });

  console.log("Seed complete");
  console.log("Login with any seeded account and password: Password123!");
  console.log("- admin@worknest.local (ADMIN)");
  console.log("- manager@worknest.local (MANAGER)");
  console.log("- member@worknest.local (MEMBER)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    const mongoose = require("mongoose");
    await mongoose.disconnect();
  });
