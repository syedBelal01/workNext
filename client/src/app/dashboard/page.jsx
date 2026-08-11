"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { formatLabel } from "@/lib/types";
import { useAuth } from "@/context/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/dashboard")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <AppShell>
      {error ? <div className="error-box">{error}</div> : null}
      {data ? (
        <>
          <div className="grid-stats">
            <div className="stat-card">
              <span>Projects in view</span>
              <strong>{data.counts.projects}</strong>
            </div>
            <div className="stat-card">
              <span>Tasks tracked</span>
              <strong>{data.counts.tasks}</strong>
            </div>
            <div className="stat-card">
              <span>Open</span>
              <strong>{data.counts.openTasks}</strong>
            </div>
            <div className="stat-card">
              <span>Done</span>
              <strong>{data.counts.doneTasks}</strong>
            </div>
          </div>
          <div className="split-2" style={{ marginTop: "1rem" }}>
            <section className="panel">
              <div className="section-head">
                <h2>Recent activity</h2>
                <Link href="/tasks" className="btn secondary">
                  View tasks
                </Link>
              </div>
              {data.recentTasks.length === 0 ? (
                <p className="muted">No tasks yet for this role.</p>
              ) : (
                <ul className="list-plain">
                  {data.recentTasks.map((task) => (
                    <li key={task.id}>
                      <strong>{task.title}</strong>
                      <span className="muted">
                        {task.project?.name} · {formatLabel(task.status)}
                        {task.assignee ? ` · ${task.assignee.name}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel">
              <div className="section-head">
                <h2>Your access</h2>
              </div>
              <p className="muted">
                Signed in as <strong>{user?.name}</strong> with role{" "}
                <span className="badge">{user?.role}</span>.
              </p>
              <ul className="hint-list">
                {user?.role === "ADMIN" && (
                  <>
                    <li>Manage users and review audit history</li>
                    <li>Full visibility across every project</li>
                  </>
                )}
                {user?.role === "MANAGER" && (
                  <>
                    <li>Create projects and assign work</li>
                    <li>Update or remove tasks on owned projects</li>
                  </>
                )}
                {user?.role === "MEMBER" && (
                  <>
                    <li>See projects you belong to</li>
                    <li>Update status on tasks assigned to you</li>
                  </>
                )}
              </ul>
              {data.usersByRole.length > 0 ? (
                <div style={{ marginTop: "1.2rem" }}>
                  <h2 style={{ fontSize: "1rem" }}>Team composition</h2>
                  <ul className="list-plain" style={{ marginTop: "0.75rem" }}>
                    {data.usersByRole.map((row) => (
                      <li key={row.role}>
                        <strong>{row.role}</strong>
                        <span className="muted">{row.count} accounts</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>
        </>
      ) : (
        !error && <p className="muted">Loading overview…</p>
      )}
    </AppShell>
  );
}
