"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, getPaginated } from "@/lib/api";
import { PROJECT_STATUSES, formatLabel } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function ProjectsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("ADMIN", "MANAGER");
  const [projects, setProjects] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "ACTIVE",
    memberIds: [],
  });

  const load = useCallback(async () => {
    try {
      const result = await getPaginated("/projects", {
        page,
        limit: 8,
        search: debouncedSearch,
        status,
      });
      setProjects(result.data);
      setTotalPages(result.meta.totalPages);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    }
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    api.get("/users/assignable").then(setUsers).catch(() => undefined);
  }, [canManage]);

  async function createProject(event) {
    event.preventDefault();
    try {
      await api.post("/projects", form);
      setOpen(false);
      setForm({ name: "", description: "", status: "ACTIVE", memberIds: [] });
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    }
  }

  async function removeProject(id) {
    if (!confirm("Delete this project and its tasks?")) return;
    try {
      await api.delete(`/projects/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell>
      <div className="toolbar">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="search">Search</label>
          <input
            id="search"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Name or description"
          />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All</option>
            {PROJECT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </div>
        {canManage ? (
          <button className="btn" type="button" onClick={() => setOpen(true)}>
            New project
          </button>
        ) : null}
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Tasks</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <strong>{project.name}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {project.description || "No description"}
                    </div>
                  </td>
                  <td>{project.owner?.name}</td>
                  <td>
                    <span className="badge">{formatLabel(project.status)}</span>
                  </td>
                  <td>{project._count?.tasks || 0}</td>
                  <td>
                    <div className="row-actions">
                      <Link
                        className="btn secondary"
                        href={`/projects/${project.id}`}
                      >
                        Open
                      </Link>
                      {canManage ? (
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => removeProject(project.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {projects.length === 0 ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            No projects match the current filters.
          </p>
        ) : null}

        <div className="pagination">
          <span className="muted">
            Page {page} of {totalPages}
          </span>
          <div className="row-actions">
            <button
              className="btn secondary"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="btn secondary"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {open ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Create project</h3>
            <form className="stack" onSubmit={createProject}>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="pstatus">Status</label>
                <select
                  id="pstatus"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {PROJECT_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {formatLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="members">Members</label>
                <select
                  id="members"
                  multiple
                  value={form.memberIds}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      memberIds: Array.from(e.target.selectedOptions).map(
                        (option) => option.value
                      ),
                    })
                  }
                  style={{ minHeight: 120 }}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="row-actions">
                <button className="btn" type="submit">
                  Create
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
