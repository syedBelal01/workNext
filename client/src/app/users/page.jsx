"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { api, getPaginated } from "@/lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "MEMBER",
  });

  const load = useCallback(async () => {
    try {
      const result = await getPaginated("/users", {
        page,
        limit: 10,
        search,
        role: role || undefined,
      });
      setUsers(result.data);
      setTotalPages(result.meta.totalPages);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  }, [page, search, role]);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(event) {
    event.preventDefault();
    try {
      await api.post("/users", form);
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "MEMBER" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user");
    }
  }

  async function toggleActive(user) {
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function changeRole(user, nextRole) {
    try {
      await api.patch(`/users/${user.id}`, { role: nextRole });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role update failed");
    }
  }

  return (
    <AppShell>
      <RoleGate roles={["ADMIN"]}>
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
              placeholder="Name or email"
            />
          </div>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              value={role}
              onChange={(e) => {
                setPage(1);
                setRole(e.target.value);
              }}
            >
              <option value="">All</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="MEMBER">Member</option>
            </select>
          </div>
          <button className="btn" type="button" onClick={() => setOpen(true)}>
            Add user
          </button>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>
                      <select
                        className="select"
                        value={item.role}
                        onChange={(e) => changeRole(item, e.target.value)}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="MEMBER">MEMBER</option>
                      </select>
                    </td>
                    <td>
                      <span
                        className={
                          item.isActive === false ? "badge danger" : "badge"
                        }
                      >
                        {item.isActive === false ? "Inactive" : "Active"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => toggleActive(item)}
                      >
                        {item.isActive === false ? "Activate" : "Deactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
              <h3>Create user</h3>
              <form className="stack" onSubmit={createUser}>
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
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    minLength={8}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="urole">Role</label>
                  <select
                    id="urole"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="MEMBER">Member</option>
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
      </RoleGate>
    </AppShell>
  );
}
