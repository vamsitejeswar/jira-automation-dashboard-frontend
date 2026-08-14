import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Overview } from "@/pages/Overview";
import { Tickets } from "@/pages/Tickets";
import { TicketDetail } from "@/pages/TicketDetail";
import { Anomalies } from "@/pages/Anomalies";
import { AuditLog } from "@/pages/AuditLog";
import { Settings } from "@/pages/Settings";
import { EmployeeSearch } from "@/pages/EmployeeSearch";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/:issueKey" element={<TicketDetail />} />
        <Route path="/employees" element={<EmployeeSearch />} />
        <Route path="/anomalies" element={<Anomalies />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
