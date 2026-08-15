import { loginUrl } from "@/api";

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.93 21.93 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

// Full-page navigation to the backend's own /api/auth/login, which redirects
// into Google's consent screen -- not a fetch call, since the OAuth redirect
// dance only works as top-level browser navigation. Styled to Google's own
// "Sign in with Google" branding guidelines (white pill, #3c4043 text, the
// official multi-color G) rather than this app's own primary button style --
// that's a hard brand requirement, not a design preference.
function GoogleSignInButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition-colors hover:bg-[#f8f9fa] hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4285F4]"
    >
      <GoogleLogo className="h-[18px] w-[18px]" />
      Sign in with Google
    </button>
  );
}

export function Login() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const ERROR_MESSAGES: Record<string, string> = {
    access_denied: "Sign-in was cancelled.",
    invalid_state: "That sign-in link expired or was already used -- try again.",
    domain_not_allowed: "That Google account isn't allowed to access this dashboard.",
    token_exchange_failed: "Google sign-in failed -- please try again.",
    userinfo_failed: "Google sign-in failed -- please try again.",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg">
          <img src="/Jira_Logo.svg" alt="Jira Automation" className="h-8 w-8 object-contain" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Jira Automation Dashboard</h1>
        <p className="mt-1.5 text-sm text-slate-500">Sign in with your work Google account to continue.</p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            {ERROR_MESSAGES[error] ?? "Something went wrong signing in -- please try again."}
          </p>
        )}

        <GoogleSignInButton onClick={() => { window.location.href = loginUrl(); }} />
      </div>
    </div>
  );
}
