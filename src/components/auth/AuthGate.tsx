import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";
import { PageSpinner } from "@/components/ui/spinner";
import { getMe } from "@/api";

// Gates every route behind a real Google sign-in (see app/routers/auth.py) --
// checks the admin_session cookie once per page load via GET /api/auth/me;
// no cookie/an expired one redirects to /login (a real, separate route --
// the OAuth callback also lands the browser there directly on a denied/
// failed sign-in, with an ?error= to explain why). retry: false since a 401
// here is an expected, common state (not signed in yet), not a transient
// failure worth retrying.
export function AuthGate() {
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false });

  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <PageSpinner />
      </div>
    );
  }
  if (me.isError) return <Navigate to="/login" replace />;
  return <Outlet />;
}
