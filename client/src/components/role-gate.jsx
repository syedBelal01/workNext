"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export function RoleGate({ roles, children }) {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !hasRole(...roles)) {
      router.replace("/dashboard");
    }
  }, [loading, user, hasRole, roles, router]);

  if (loading || !user || !hasRole(...roles)) {
    return (
      <div className="panel empty-state">
        <p>Checking permissions…</p>
      </div>
    );
  }

  return children;
}
