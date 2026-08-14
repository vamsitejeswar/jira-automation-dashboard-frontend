import * as XLSX from "xlsx";

export function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  sheetName = "Sheet1"
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  // Auto column widths
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.map((r) => String(r[key] ?? "").length)
    ),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function ticketsToExcelRows(tickets: {
  issueKey: string;
  flow: string;
  currentStatus: string;
  employeeEmail: string | null;
  managerEmail: string | null;
  updatedAt: string;
  hasError: boolean;
}[]) {
  return tickets.map((t) => ({
    "Issue Key": t.issueKey,
    Flow: t.flow,
    Status: t.currentStatus,
    "Employee Email": t.employeeEmail ?? "",
    "Manager Email": t.managerEmail ?? "",
    "Last Updated (IST)": t.updatedAt,
    "Has Error": t.hasError ? "Yes" : "No",
  }));
}

export function auditLogToExcelRows(events: {
  timestamp: string;
  severity: string;
  flow: string;
  outcome: string;
  issueKey: string | null;
  error: string | null;
}[]) {
  return events.map((e) => ({
    "Timestamp (UTC)": e.timestamp,
    Severity: e.severity,
    Flow: e.flow,
    Outcome: e.outcome,
    "Issue Key": e.issueKey ?? "",
    Error: e.error ?? "",
  }));
}
