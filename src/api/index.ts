// Single import point for all API calls -- always the real FastAPI backend.
// See vite.config.ts's dev proxy (/api -> http://localhost:8000) and
// VITE_API_TOKEN in client.ts.
export * from "./types";

export * from "./client";
