"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { TASK_PRIORITIES, TASK_STATUSES, formatLabel } from "@/lib/types";
import { useAuth } from "@/context/auth-context";

export default function ProjectDetailPage() {
  const params = useParams();
  const { user, hasRole } = useAuth();
  const [project, setProject] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: "",
  });

  const canCreate =
    hasRole("ADMIN", "MANAGER") ||
    (hasRole("MEMBER") &&
      !!project?.members?.some((member) => member.user.id === user?.id));

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/projects/${params.id}`);
      setProject(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function createTask(event) {
    event.preventDefault();
    try {
      await api.post(`/projects/${params.id}/tasks`, {
        ...form,
        assigneeId: form.assigneeId || null,
      });
      setForm({
        title: "",
        description: "",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    }
  }

  return (
    <AppShell>
      <div className="section-head">
        <div>
          <Link href="/projects" className="muted">
            ← Back to projects
          </Link>
          <h2 style={{ marginTop: 8 }}>{project?.name || "Project"}</h2>
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      {project ? (
        <div className="split-2">
          <section className="panel">
            <p className="muted">{project.description || "No description"}</p>
            <div className="row-actions" style={{ margin: "1rem 0" }}>
              <span className="badge">{formatLabel(project.status)}</span>
              <span className="badge neutral">Owner: {project.owner?.name}</span>
            </div>
            <h3 style={{ marginBottom: "0.75rem" }}>Tasks</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {(project.tasks || []).map((task) => (
                    <tr key={task.id}>
                      <td>
                        <Link href={`/tasks?highlight=${task.id}`}>
                          <strong>{task.title}</strong>
                        </Link>
                      </td>
                      <td>{formatLabel(task.status)}</td>
                      <td>
                        <span
                          className={
                            task.priority === "URGENT" ||
                            task.priority === "HIGH"
                              ? "badge warn"
                              : "badge"
                          }
                        >
                          {formatLabel(task.priority)}
                        </span>
                      </td>
                      <td>{task.assignee?.name || "Unassigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {canCreate ? (
            <section className="panel">
              <h3 style={{ marginTop: 0 }}>Add task</h3>
              <form className="stack" onSubmit={createTask}>
                <div className="field">
                  <label htmlFor="title">Title</label>
                  <input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="tdesc">Description</label>
                  <textarea
                    id="tdesc"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="tstatus">Status</label>
                  <select
                    id="tstatus"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {TASK_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {formatLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>
                {hasRole("ADMIN", "MANAGER") ? (
                  <>
                    <div className="field">
                      <label htmlFor="priority">Priority</label>
                      <select
                        id="priority"
                        value={form.priority}
                        onChange={(e) =>
                          setForm({ ...form, priority: e.target.value })
                        }
                      >
                        {TASK_PRIORITIES.map((item) => (
                          <option key={item} value={item}>
                            {formatLabel(item)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="assignee">Assignee</label>
                      <select
                        id="assignee"
                        value={form.assigneeId}
                        onChange={(e) =>
                          setForm({ ...form, assigneeId: e.target.value })
                        }
                      >
                        <option value="">Unassigned</option>
                        {(project.members || []).map((member) => (
                          <option key={member.user.id} value={member.user.id}>
                            {member.user.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}
                <button className="btn" type="submit">
                  Create task
                </button>
              </form>
            </section>
          ) : null}
        </div>
      ) : (
        !error && <p className="muted">Loading project…</p>
      )}
    </AppShell>
  );
}
