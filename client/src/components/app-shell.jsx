"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "Tasks" },
  { href: "/users", label: "Users", roles: ["ADMIN"] },
  { href: "/audit", label: "Audit log", roles: ["ADMIN"] },
];

export function AppShell({ children }) {
  const { user, loading, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading workspace…</p>
      </div>
    );
  }

  const visibleNav = navItems.filter(
    (item) => !item.roles || item.roles.some((role) => hasRole(role))
  );

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">WN</span>
          <div>
            <p className="brand-name">WorkNest</p>
            <p className="brand-tag">Project control</p>
          </div>
        </div>
        <nav className="side-nav">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                pathname.startsWith(item.href) ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="side-footer">
          <div className="user-chip">
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
          <button type="button" className="ghost-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main-pane">
        <header className="topbar">
          <div className="topbar-text">
            <p className="eyebrow">Signed in as {user.email}</p>
            <h1 className="page-kicker">
              {visibleNav.find((item) => pathname.startsWith(item.href))
                ?.label || "Workspace"}
            </h1>
          </div>
          <div className="topbar-actions">
            <div className="topbar-user">
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
            <button
              type="button"
              className="btn secondary signout-btn"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </header>
        <nav className="mobile-nav">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                pathname.startsWith(item.href) ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
