"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { getPaginated } from "@/lib/api";

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await getPaginated("/audit-logs", { page, limit: 15 });
      setLogs(result.data);
      setTotalPages(result.meta.totalPages);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <RoleGate roles={["ADMIN"]}>
        {error ? <div className="error-box">{error}</div> : null}
        <section className="panel">
          <div className="section-head">
            <h2>Recent security events</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.actor?.name || "System"}</td>
                    <td>
                      <span className="badge">{log.action}</span>
                    </td>
                    <td>
                      {log.entityType}
                      {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
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
      </RoleGate>
    </AppShell>
  );
}
