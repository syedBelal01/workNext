const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { Role, TaskPriority, TaskStatus } = require("../src/lib/constants");

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@worknest.local",
      name: "Aisha Khan",
      role: Role.ADMIN,
      passwordHash,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: "manager@worknest.local",
      name: "Rahul Mehta",
      role: Role.MANAGER,
      passwordHash,
    },
  });

  const member = await prisma.user.create({
    data: {
      email: "member@worknest.local",
      name: "Sara Ali",
      role: Role.MEMBER,
      passwordHash,
    },
  });

  const memberTwo = await prisma.user.create({
    data: {
      email: "dev@worknest.local",
      name: "Omar Farid",
      role: Role.MEMBER,
      passwordHash,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Customer Portal Revamp",
      description:
        "Rebuild the customer portal with improved UX, SSO, and reporting.",
      status: "ACTIVE",
      ownerId: manager.id,
      startDate: new Date(),
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
      members: {
        create: [
          { userId: manager.id },
          { userId: member.id },
          { userId: memberTwo.id },
        ],
      },
    },
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Map current portal workflows",
        description: "Document existing user journeys and pain points.",
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        projectId: project.id,
        assigneeId: member.id,
        createdById: manager.id,
      },
      {
        title: "Design dashboard wireframes",
        description: "Produce low-fidelity screens for the new dashboard.",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        projectId: project.id,
        assigneeId: memberTwo.id,
        createdById: manager.id,
      },
      {
        title: "Implement SSO handshake",
        description: "Integrate OIDC login against the identity provider.",
        status: TaskStatus.TODO,
        priority: TaskPriority.URGENT,
        projectId: project.id,
        assigneeId: member.id,
        createdById: manager.id,
      },
      {
        title: "Stakeholder review checkpoint",
        description: "Collect feedback from sales and support leads.",
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        projectId: project.id,
        assigneeId: manager.id,
        createdById: admin.id,
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_COMPLETE",
      entityType: "System",
      metadata: { users: 4, projects: 1 },
    },
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
    await prisma.$disconnect();
  });
