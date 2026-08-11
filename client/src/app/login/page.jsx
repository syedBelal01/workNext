"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("manager@worknest.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-copy">
          <p className="eyebrow" style={{ color: "#9ed9bb" }}>
            WorkNest
          </p>
          <h1>Keep projects moving without blurring responsibilities.</h1>
          <p>
            A practical tracker where admins govern people, managers own delivery,
            and members focus on the work assigned to them.
          </p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="panel auth-card">
          <h2>Sign in</h2>
          <p className="lede">Use a seeded account to explore each role.</p>
          <form className="stack" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <div className="error-box">{error}</div> : null}
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Enter workspace"}
            </button>
          </form>
          <div className="demo-creds">
            <p>
              Shared password: <code>Password123!</code>
            </p>
            <ul>
              <li>admin@worknest.local — full control</li>
              <li>manager@worknest.local — project ownership</li>
              <li>member@worknest.local — assigned work only</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
