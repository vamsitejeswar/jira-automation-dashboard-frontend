import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Zap, RefreshCw, SunMoon, Hash, LifeBuoy, BellRing, DoorClosed, UserCog, Webhook } from "lucide-react";
import {
  GoogleIcon, GoogleDriveIcon, GmailIcon, Microsoft365Icon,
  ActiveDirectoryIcon, AkamaiIcon, AutomationIcon,
} from "@/components/app/brand-icons";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { getToggles, updateToggle, getConfig, updateConfig, getAuditLog } from "@/api";
import { formatIST } from "@/lib/utils";
import type { Toggle, ToggleName, ConfigValue, ConfigName } from "@/api";

const TOGGLE_LABELS: Record<ToggleName, string> = {
  automation_enabled:           "Automation",
  email_sending_enabled:        "Email Sending",
  gws_account_creation_enabled: "Google Workspace Account Creation",
  retry_on_update_enabled:      "Retry On Update",
  akamai_enabled:               "Akamai",
  gws_account_suspend_enabled:  "Google Workspace Account Suspend",
  data_transfer_enabled:        "Data Transfer",
  ad_disable_enabled:           "Active Directory Disable",
  m365_disable_enabled:         "M365 Disable",
  isecure_onboard_enabled:      "iSecure Onboard",
  isecure_offboard_enabled:     "iSecure Offboard",
  software_revoke_enabled:      "Software Access Revoke Webhook",
};

const DESCRIPTIONS: Record<ToggleName, string> = {
  automation_enabled:
    "Master switch for the entire automation: new tickets, scheduled emails, and Drive transfers.",
  email_sending_enabled:
    "All outgoing emails: welcome emails, login credentials, and approval requests.",
  gws_account_creation_enabled:
    "Creating new Google Workspace accounts for onboarding tickets.",
  retry_on_update_enabled:
    "Automatically retrying a failed onboarding ticket when it is updated.",
  akamai_enabled:
    "Akamai / ZScaler access approval emails. Independent of mailbox creation.",
  gws_account_suspend_enabled:
    "Suspending a departing employee's Google Workspace account.",
  data_transfer_enabled:
    "Transferring a departing employee's Drive files to their manager.",
  ad_disable_enabled:
    "Disabling a departing employee's on-premise Active Directory account.",
  m365_disable_enabled:
    "Disabling a departing employee's Microsoft 365/Entra ID account and emailing their manager.",
  isecure_onboard_enabled:
    "Adding a new employee to the iSecure/Aero physical access-control system (door cards) on the \"Admin Support\" subtask.",
  isecure_offboard_enabled:
    "Deactivating a departing employee's iSecure/Aero physical access-control cards on the \"Admin Support\" subtask.",
  software_revoke_enabled:
    "Recording status updates from external systems for the Software Access Revoke subtask.",
};

const TOGGLE_ICONS: Record<ToggleName, React.ElementType> = {
  automation_enabled:           AutomationIcon,
  email_sending_enabled:        GmailIcon,
  gws_account_creation_enabled: GoogleIcon,
  retry_on_update_enabled:      RefreshCw,
  akamai_enabled:               AkamaiIcon,
  gws_account_suspend_enabled:  GoogleIcon,
  data_transfer_enabled:        GoogleDriveIcon,
  ad_disable_enabled:           ActiveDirectoryIcon,
  m365_disable_enabled:         Microsoft365Icon,
  isecure_onboard_enabled:      DoorClosed,
  isecure_offboard_enabled:     DoorClosed,
  software_revoke_enabled:      Webhook,
};

// Real fixed-color logos/icons -- recoloring them via the row's accent would
// misrepresent the actual mark, so they're drawn at full size with no tint
// applied, unlike the single generic (currentColor) icon below.
const BRAND_LOGO_ICONS = new Set<React.ElementType>([
  GoogleIcon, GoogleDriveIcon, GmailIcon, Microsoft365Icon, ActiveDirectoryIcon, AkamaiIcon, AutomationIcon,
]);

const TOGGLE_ACCENT: Record<ToggleName, string> = {
  automation_enabled:           "#2563eb",
  email_sending_enabled:        "#7c3aed",
  gws_account_creation_enabled: "#059669",
  retry_on_update_enabled:      "#d97706",
  akamai_enabled:               "#0891b2",
  gws_account_suspend_enabled:  "#dc2626",
  data_transfer_enabled:        "#ea580c",
  ad_disable_enabled:           "#b91c1c",
  m365_disable_enabled:         "#4338ca",
  isecure_onboard_enabled:      "#059669",
  isecure_offboard_enabled:     "#b91c1c",
  software_revoke_enabled:      "#475569",
};

const SECTIONS: { title: string; subtitle: string; names: ToggleName[] }[] = [
  {
    title:    "Global",
    subtitle: "Master controls that affect the entire automation system",
    names:    ["automation_enabled", "email_sending_enabled"],
  },
  {
    title:    "Onboarding",
    subtitle: "Controls for new employee onboarding flows",
    names:    ["gws_account_creation_enabled", "retry_on_update_enabled", "isecure_onboard_enabled"],
  },
  {
    title:    "Access Approvals",
    subtitle: "Third-party access provisioning flows",
    names:    ["akamai_enabled"],
  },
  {
    title:    "Offboarding",
    subtitle: "Controls for departing employee offboarding flows",
    names:    [
      "gws_account_suspend_enabled", "data_transfer_enabled",
      "ad_disable_enabled", "m365_disable_enabled", "isecure_offboard_enabled",
      "software_revoke_enabled",
    ],
  },
];

// icon + accent per Config value -- Drive Common Mail reuses the same Drive
// icon as the Data Transfer toggle since it's literally that flow's fallback
// address.
const CONFIG_ICONS: Record<ConfigName, React.ElementType> = {
  jira_project_key:                 Hash,
  it_mail:                          LifeBuoy,
  admin_mail:                       BellRing,
  drive_common_mail:                GoogleDriveIcon,
  isecure_company:                  DoorClosed,
  isecure_default_access_group_ids: DoorClosed,
  hr_allowed_emails:                UserCog,
};

const CONFIG_ACCENT: Record<ConfigName, string> = {
  jira_project_key:                 "#2563eb",
  it_mail:                          "#0891b2",
  admin_mail:                       "#dc2626",
  drive_common_mail:                "#ea580c",
  isecure_company:                  "#059669",
  isecure_default_access_group_ids: "#059669",
  hr_allowed_emails:                "#7c3aed",
};

function ToggleRow({
  toggle,
  onToggle,
  isPending,
}: {
  toggle: Toggle;
  onToggle: (name: string, value: boolean) => void;
  isPending: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const Icon   = TOGGLE_ICONS[toggle.name] ?? Zap;
  const accent = TOGGLE_ACCENT[toggle.name] ?? "#2563eb";
  const isBrandLogo = BRAND_LOGO_ICONS.has(Icon);
  const isMaster = toggle.name === "automation_enabled";

  function handleChange(newVal: boolean) {
    if (isMaster && !newVal) {
      setConfirmOpen(true);
      return;
    }
    onToggle(toggle.name, newVal);
  }

  return (
    <div
      className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-neutral-800/50`}
    >
      {/* Icon */}
      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 mt-0.5">
        <Icon
          className={isBrandLogo ? "h-6 w-6" : "h-5 w-5"}
          style={isBrandLogo ? undefined : { color: accent }}
        />

      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
            {TOGGLE_LABELS[toggle.name] ?? toggle.name}
          </span>

        </div>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed dark:text-neutral-400">{DESCRIPTIONS[toggle.name]}</p>
        {toggle.lastChangedAt && (
          <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
            Last changed {formatIST(toggle.lastChangedAt)}
            {toggle.lastChangedBy ? ` by ${toggle.lastChangedBy}` : ""}
          </p>
        )}

        {/* Confirm inline */}
        {confirmOpen && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/40">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 dark:text-red-400" />
            <span className="text-xs text-red-700 font-medium flex-1 dark:text-red-300">
              Disable the master switch? This stops all automation immediately.
            </span>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={() => {
                onToggle(toggle.name, false);
                setConfirmOpen(false);
              }}
              className="h-7 text-xs"
            >
              Disable
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Toggle switch */}
      {!confirmOpen && (
        <div className="flex-shrink-0 mt-0.5">
          <Switch checked={toggle.value} disabled={isPending} onCheckedChange={handleChange} />
        </div>
      )}
    </div>
  );
}

function ConfigRow({
  config,
  onSave,
  isPending,
}: {
  config: ConfigValue;
  onSave: (name: string, value: string) => void;
  isPending: boolean;
}) {
  const [value, setValue] = useState(config.value);
  useEffect(() => setValue(config.value), [config.value]);
  const Icon = CONFIG_ICONS[config.name] ?? Hash;
  const accent = CONFIG_ACCENT[config.name] ?? "#2563eb";
  const isBrandLogo = BRAND_LOGO_ICONS.has(Icon);
  const dirty = value !== config.value;

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 mt-0.5">
        <Icon
          className={isBrandLogo ? "h-6 w-6" : "h-5 w-5"}
          style={isBrandLogo ? undefined : { color: accent }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-neutral-200">{config.label}</p>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed dark:text-neutral-400">{config.description}</p>
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Not set"
            className="h-8 text-xs max-w-sm"
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs" disabled={!dirty || isPending}>
                Save
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Save {config.label}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This change takes effect immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onSave(config.name, value)}>
                  Save
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function parseEmailList(value: string): string[] {
  return value.split("\n").map((e) => e.trim()).filter(Boolean);
}

// One config value (hr_allowed_emails) is genuinely a list of people, not a
// single string -- a single "Manage" button opens a real add/remove UI
// instead of ConfigRow's plain single-line Input, matching how a list of
// named people should actually be edited.
function HrAllowedEmailsManager({
  config,
  onSave,
  isPending,
}: {
  config: ConfigValue;
  onSave: (name: string, value: string) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>(() => parseEmailList(config.value));
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const Icon = CONFIG_ICONS[config.name] ?? Hash;
  const accent = CONFIG_ACCENT[config.name] ?? "#2563eb";
  const currentCount = parseEmailList(config.value).length;

  function resetToSaved() {
    setEmails(parseEmailList(config.value));
    setNewEmail("");
    setError(null);
  }

  function addEmail() {
    const candidate = newEmail.trim().toLowerCase();
    if (!candidate) return;
    if (!EMAIL_RE.test(candidate)) {
      setError("Enter a valid email address");
      return;
    }
    if (emails.includes(candidate)) {
      setError("Already added");
      return;
    }
    setEmails((prev) => [...prev, candidate]);
    setNewEmail("");
    setError(null);
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email));
  }

  function handleSave() {
    onSave(config.name, emails.join("\n"));
    setOpen(false);
  }

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 mt-0.5">
        <Icon className="h-5 w-5" style={{ color: accent }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-neutral-200">{config.label}</p>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed dark:text-neutral-400">{config.description}</p>
        <p className="mt-1.5 text-xs text-slate-400 dark:text-neutral-500">
          {currentCount === 0 ? "No one allowed yet" : `${currentCount} ${currentCount === 1 ? "person" : "people"} allowed`}
        </p>
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) resetToSaved();
          }}
        >
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="mt-2 h-8 text-xs">
              Manage
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Manage {config.label}</AlertDialogTitle>
              <AlertDialogDescription>
                Add or remove who can sign in to the HR Dashboard.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="mt-3 flex items-center gap-2">
              <Input
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                placeholder="name@company.com"
                className="h-8 text-xs"
              />
              <Button size="sm" variant="outline" className="h-8 text-xs flex-shrink-0" onClick={addEmail}>
                Add
              </Button>
            </div>
            {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border divide-y divide-slate-100 dark:divide-neutral-800 dark:border-neutral-800">
              {emails.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-400 dark:text-neutral-500">No one added yet.</p>
              ) : (
                emails.map((email) => (
                  <div key={email} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-xs text-slate-700 dark:text-neutral-300 truncate">{email}</span>
                    <button
                      onClick={() => removeEmail(email)}
                      className="text-xs text-slate-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400 flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSave} disabled={isPending}>
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function GeneralSkeleton() {
  return (
    <div className="space-y-4">
      {SECTIONS.map(({ title, names }) => (
        <div key={title} className="rounded-xl bg-white shadow-sm overflow-hidden dark:bg-neutral-900">
          <div className="px-5 py-4 space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="space-y-4 px-5 pb-5">
            {names.map((n) => (
              <div key={n} className="flex items-start gap-4">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2 min-w-0">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-full max-w-xs" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full flex-shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function humanizeConfigName(name: string): string {
  return name.split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

// Config edits have no issueKey, so they're kept out of the Failures &
// History event feed (see _SETTINGS_CHANGE_FLOWS in admin_api.py) -- this is
// their own home instead, right next to the fields they changed.
function ConfigHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ["config-history"],
    queryFn:  () => getAuditLog({ flow: "config_change", pageSize: 8 }),
  });

  const events = data?.results ?? [];
  if (isLoading || events.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-neutral-900">
      <div className="px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">Recent changes</h2>
        <p className="text-xs text-slate-500 mt-0.5 dark:text-neutral-400">Last {events.length} config edits</p>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-neutral-800">
        {events.map((e, i) => {
          const configName = typeof e.config === "string" ? e.config : "";
          const oldValue = e.oldValue == null || e.oldValue === "" ? "(empty)" : String(e.oldValue);
          const newValue = e.newValue == null || e.newValue === "" ? "(empty)" : String(e.newValue);
          return (
            <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-xs">
              <span className="w-36 flex-shrink-0 font-semibold text-slate-700 dark:text-neutral-300">
                {humanizeConfigName(configName)}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-neutral-400">
                {oldValue} &rarr; {newValue}
              </span>
              <span className="flex-shrink-0 whitespace-nowrap text-slate-400 dark:text-neutral-500">
                {e.changedBy ? `${e.changedBy} · ` : ""}{formatIST(e.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfigSkeleton() {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-neutral-900 divide-y divide-slate-100 dark:divide-neutral-800">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full max-w-xs" />
            <Skeleton className="h-8 w-full max-w-sm mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GeneralTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["toggles"],
    queryFn:  getToggles,
  });

  const mutation = useMutation({
    mutationFn: ({ name, value }: { name: string; value: boolean }) =>
      updateToggle(name, value),
    onMutate: async ({ name, value }) => {
      await qc.cancelQueries({ queryKey: ["toggles"] });
      const prev = qc.getQueryData<{ toggles: Toggle[] }>(["toggles"]);
      qc.setQueryData<{ toggles: Toggle[] }>(["toggles"], (old) =>
        old
          ? { toggles: old.toggles.map((t) => (t.name === name ? { ...t, value } : t)) }
          : old
      );
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["toggles"], ctx.prev);
      toast.add({
        title: "Update failed",
        description: `Couldn't ${vars.value ? "enable" : "disable"} ${TOGGLE_LABELS[vars.name as ToggleName] ?? vars.name}.`,
      });
    },
    onSuccess: (_data, vars) => {
      toast.add({
        title: `${TOGGLE_LABELS[vars.name as ToggleName] ?? vars.name} ${vars.value ? "enabled" : "disabled"}`,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["toggles"] }),
  });

  const toggleMap = data ? Object.fromEntries(data.toggles.map((t) => [t.name, t])) : {};

  if (isLoading) return <GeneralSkeleton />;
  if (isError) return <ErrorState error={error as Error} />;

  return (
    <div className="space-y-4">
      {SECTIONS.map(({ title, subtitle, names }) => (
        <div key={title} className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-neutral-900">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">{title}</h2>
            <p className="text-xs text-slate-500 mt-0.5 dark:text-neutral-400">{subtitle}</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-neutral-800">
            {names.map((name) => {
              const toggle = toggleMap[name];
              if (!toggle) return null;
              return (
                <ToggleRow
                  key={name}
                  toggle={toggle}
                  onToggle={(n, v) => mutation.mutate({ name: n, value: v })}
                  isPending={mutation.isPending}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfigTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["config"],
    queryFn:  getConfig,
    // Same reasoning as the Anomalies query -- a missing label/description
    // from the backend is a schema mismatch, not a transient failure, so
    // retrying 3x with backoff just delays the (identical) error.
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) =>
      updateConfig(name, value),
    onError: (_err, vars) => {
      toast.add({
        title: "Update failed",
        description: `Couldn't save ${vars.name}.`,
      });
    },
    onSuccess: (_data, vars) => {
      toast.add({ title: `Saved`, description: vars.name });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["config"] }),
  });

  if (isLoading) return <ConfigSkeleton />;
  if (isError) return <ErrorState error={error as Error} />;

  return (
    <>
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-neutral-900">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">Config</h2>
          <p className="text-xs text-slate-500 mt-0.5 dark:text-neutral-400">
            Changes take effect immediately.
          </p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-neutral-800">
          {(data?.config ?? []).map((config) =>
            config.name === "hr_allowed_emails" ? (
              <HrAllowedEmailsManager
                key={config.name}
                config={config}
                onSave={(name, value) => mutation.mutate({ name, value })}
                isPending={mutation.isPending}
              />
            ) : (
              <ConfigRow
                key={config.name}
                config={config}
                onSave={(name, value) => mutation.mutate({ name, value })}
                isPending={mutation.isPending}
              />
            )
          )}
        </div>
      </div>
      <ConfigHistory />
    </>
  );
}

function AppearanceTab() {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-neutral-900">
      <div className="px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">Appearance</h2>
        <p className="text-xs text-slate-500 mt-0.5 dark:text-neutral-400">How the dashboard looks on this device</p>
      </div>
      <div className="flex items-start gap-4 px-5 py-4 border-t border-slate-100 dark:border-neutral-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 mt-0.5">
          <SunMoon className="h-5 w-5" style={{ color: "#4338ca" }} />
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-neutral-200">Theme</p>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed dark:text-neutral-400">Light, dark, or match your system setting.</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  return (
    <div className="min-h-full bg-slate-50 dark:bg-neutral-950">
      <div className="px-4 py-4 max-w-3xl">
        <Tabs defaultValue="general">
          <TabsList className="mb-4">
            <TabsIndicator />
            <TabsTab value="general">General</TabsTab>
            <TabsTab value="config">Config</TabsTab>
            <TabsTab value="appearance">Appearance</TabsTab>
          </TabsList>

          <TabsPanel value="general"><GeneralTab /></TabsPanel>
          <TabsPanel value="config"><ConfigTab /></TabsPanel>
          <TabsPanel value="appearance"><AppearanceTab /></TabsPanel>
        </Tabs>
      </div>
    </div>
  );
}
