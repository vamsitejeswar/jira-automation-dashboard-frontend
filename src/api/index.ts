// Single import point for all API calls.
// Set VITE_USE_MOCK=true in .env.development to use mock data.
// Remove that variable (or set it to false) once real APIs are ready.
export * from "./types";

export {
  getTickets,
  getTicketDetail,
  getKpis,
  getToggles,
  updateToggle,
  getAnomalies,
  getScheduledJobs,
  getAuditLog,
  getEmployeeProgress,
} from "./mock-client";

export type { TicketFilters, KpiFilters, AnomalyFilters, AuditLogFilters } from "./client";
