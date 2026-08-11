"use client";

import { Suspense } from "react";
import TasksPage from "./tasks-client";

export default function TasksRoute() {
  return (
    <Suspense
      fallback={
        <div className="app-loading">
          <div className="spinner" />
          <p>Loading tasks…</p>
        </div>
      }
    >
      <TasksPage />
    </Suspense>
  );
}
