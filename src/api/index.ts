// Single import point for all API calls.
// Set VITE_USE_MOCK=true in .env.local to use mock data instead of the real
// backend (e.g. running the frontend standalone with no FastAPI service).
// Defaults to the real backend otherwise -- see vite.config.ts's dev proxy
// (/api -> http://localhost:8000) and VITE_API_TOKEN in client.ts.
export * from "./types";

import * as mockClient from "./mock-client";
import * as realClient from "./client";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const impl = USE_MOCK ? mockClient : realClient;

export const getTickets = impl.getTickets;
export const getTicketDetail = impl.getTicketDetail;
export const getKpis = impl.getKpis;
export const getToggles = impl.getToggles;
export const updateToggle = impl.updateToggle;
export const getAnomalies = impl.getAnomalies;
export const getScheduledJobs = impl.getScheduledJobs;
export const getAuditLog = impl.getAuditLog;
export const getEmployeeProgress = impl.getEmployeeProgress;

export type { TicketFilters, KpiFilters, AnomalyFilters, AuditLogFilters } from "./client";
