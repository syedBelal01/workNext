import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("WorkNest API", () => {
  let adminToken = "";
  let managerToken = "";
  let memberToken = "";
  let projectId = "";
  let memberTaskId = "";

  beforeAll(async () => {
    const adminLogin = await request(app).post("/api/auth/login").send({
      email: "admin@worknest.local",
      password: "Password123!",
    });
    const managerLogin = await request(app).post("/api/auth/login").send({
      email: "manager@worknest.local",
      password: "Password123!",
    });
    const memberLogin = await request(app).post("/api/auth/login").send({
      email: "member@worknest.local",
      password: "Password123!",
    });

    adminToken = adminLogin.body.data?.token ?? "";
    managerToken = managerLogin.body.data?.token ?? "";
    memberToken = memberLogin.body.data?.token ?? "";
  });

  it("rejects invalid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@worknest.local",
      password: "wrong-password",
    });
    expect(res.status).toBe(401);
  });

  it("blocks members from listing users", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it("allows admin to list users", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("prevents members from creating projects", async () => {
    const res = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ name: "Should Fail" });
    expect(res.status).toBe(403);
  });

  it("lets a manager create a project and member see it after invite", async () => {
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${memberToken}`);

    const create = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "QA Sprint Board",
        description: "Short-lived board for regression tracking",
        status: "ACTIVE",
        memberIds: [me.body.data.id],
      });

    expect(create.status).toBe(201);
    projectId = create.body.data.id;

    const memberView = await request(app)
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(memberView.status).toBe(200);
    expect(memberView.body.data.name).toBe("QA Sprint Board");
  });

  it("enforces member task update restrictions", async () => {
    const createTask = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        title: "Smoke test login flow",
        priority: "HIGH",
        status: "TODO",
      });

    expect(createTask.status).toBe(201);

    const assignable = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${memberToken}`);

    const assigned = await request(app)
      .patch(`/api/tasks/${createTask.body.data.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ assigneeId: assignable.body.data.id });

    expect(assigned.status).toBe(200);
    memberTaskId = assigned.body.data.id;

    const forbidden = await request(app)
      .patch(`/api/tasks/${memberTaskId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ priority: "LOW" });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .patch(`/api/tasks/${memberTaskId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ status: "IN_PROGRESS" });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.status).toBe("IN_PROGRESS");
  });

  it("keeps audit logs admin-only", async () => {
    const denied = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(denied.status).toBe(403);

    const allowed = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
    expect(Array.isArray(allowed.body.data)).toBe(true);
  });
});
