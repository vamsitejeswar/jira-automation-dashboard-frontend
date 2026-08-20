import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/api";

// Runs *after* AuthGate has already confirmed a real session -- this only
// decides which of the two route subtrees that session is allowed into. An
// hr-role session hitting any non-/hr/* path (including "/") is bounced to
// /hr/tickets; an admin session hitting /hr/* is bounced to "/" -- each role
// only ever sees its own tree, matching the backend's separate /api/hr/*
// vs /api/admin/* scoping (see app/routers/hr_api.py).
export function RoleRouter() {
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false });
  const location = useLocation();

  // AuthGate already handled the loading/error states -- by the time this
  // renders, me.data is present (a valid session exists).
  if (!me.data) return null;

  const isHr = me.data.role === "hr";
  const onHrPath = location.pathname.startsWith("/hr");

  if (isHr && !onHrPath) return <Navigate to="/hr/tickets" replace />;
  if (!isHr && onHrPath) return <Navigate to="/" replace />;
  return <Outlet />;
}
