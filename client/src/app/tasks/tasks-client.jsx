"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api, getPaginated } from "@/lib/api";
import { TASK_PRIORITIES, TASK_STATUSES, formatLabel } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function TasksPage() {
  const { hasRole, user } = useAuth();
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const [tasks, setTasks] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await getPaginated("/tasks", {
        page,
        limit: 10,
        search: debouncedSearch,
        status,
        priority,
      });
      setTasks(result.data);
      setTotalPages(result.meta.totalPages);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    }
  }, [page, debouncedSearch, status, priority]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateTask(id, body) {
    try {
      await api.patch(`/tasks/${id}`, body);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function removeTask(id) {
    if (!confirm("Delete this task?")) return;
    try {
      await api.delete(`/tasks/${id}`);
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
            placeholder="Title or description"
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
            {TASK_STATUSES.map((item) => (
              <option key={item} value={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="priority">Priority</label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => {
              setPage(1);
              setPriority(e.target.value);
            }}
          >
            <option value="">All</option>
            {TASK_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const canEditFully = hasRole("ADMIN", "MANAGER");
                const canEditStatus =
                  canEditFully ||
                  (hasRole("MEMBER") && task.assigneeId === user?.id);

                return (
                  <tr
                    key={task.id}
                    style={
                      highlight === task.id
                        ? { background: "rgba(31, 122, 84, 0.08)" }
                        : undefined
                    }
                  >
                    <td>
                      <strong>{task.title}</strong>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {task.description || "—"}
                      </div>
                    </td>
                    <td>{task.project?.name}</td>
                    <td>
                      {canEditStatus ? (
                        <select
                          className="select"
                          value={task.status}
                          onChange={(e) =>
                            updateTask(task.id, { status: e.target.value })
                          }
                        >
                          {TASK_STATUSES.map((item) => (
                            <option key={item} value={item}>
                              {formatLabel(item)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        formatLabel(task.status)
                      )}
                    </td>
                    <td>
                      {canEditFully ? (
                        <select
                          className="select"
                          value={task.priority}
                          onChange={(e) =>
                            updateTask(task.id, { priority: e.target.value })
                          }
                        >
                          {TASK_PRIORITIES.map((item) => (
                            <option key={item} value={item}>
                              {formatLabel(item)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        formatLabel(task.priority)
                      )}
                    </td>
                    <td>{task.assignee?.name || "Unassigned"}</td>
                    <td>
                      {canEditFully ? (
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => removeTask(task.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {tasks.length === 0 ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            No tasks found for the current filters.
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
    </AppShell>
  );
}
