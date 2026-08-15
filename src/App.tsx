import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGate } from "@/components/auth/AuthGate";
import { Login } from "@/pages/Login";
import { Overview } from "@/pages/Overview";
import { Tickets } from "@/pages/Tickets";
import { TicketDetail } from "@/pages/TicketDetail";
import { Anomalies } from "@/pages/Anomalies";
import { Settings } from "@/pages/Settings";
import { EmployeeSearch } from "@/pages/EmployeeSearch";
import { Approvals } from "@/pages/Approvals";
import { Schedules } from "@/pages/Schedules";
import { AutomationDetail } from "@/pages/AutomationDetail";

export default function App() {
  return (
    <Toaster position="top">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AuthGate />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/:issueKey" element={<TicketDetail />} />
            <Route path="/employees" element={<EmployeeSearch />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/anomalies" element={<Anomalies />} />
            <Route path="/audit-log" element={<Anomalies />} />
            <Route path="/automations/:flow" element={<AutomationDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </Toaster>
  );
}
