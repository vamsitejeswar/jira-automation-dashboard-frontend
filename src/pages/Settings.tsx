import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Zap, Mail, UserPlus, RefreshCw, Shield, UserMinus, HardDrive, UserX, Laptop } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { getToggles, updateToggle } from "@/api";
import { formatIST } from "@/lib/utils";
import type { Toggle, ToggleName } from "@/api";

const TOGGLE_LABELS: Record<ToggleName, string> = {
  automation_enabled:           "Automation",
  email_sending_enabled:        "Email Sending",
  gws_account_creation_enabled: "Google Woskspace Account Creation",
  retry_on_update_enabled:      "Retry On Update",
  akamai_enabled:               "Akamai",
  gws_account_suspend_enabled:  "Google Workspace Account Suspend",
  data_transfer_enabled:        "Data Transfer",
  ad_disable_enabled:           "Active Directory Disable",
  m365_disable_enabled:         "M365 Disable",
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
};

const TOGGLE_ICONS: Record<ToggleName, React.ElementType> = {
  automation_enabled:           Zap,
  email_sending_enabled:        Mail,
  gws_account_creation_enabled: UserPlus,
  retry_on_update_enabled:      RefreshCw,
  akamai_enabled:               Shield,
  gws_account_suspend_enabled:  UserMinus,
  data_transfer_enabled:        HardDrive,
  ad_disable_enabled:           UserX,
  m365_disable_enabled:         Laptop,
};

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
};

const SECTIONS: { title: string; subtitle: string; names: ToggleName[] }[] = [
  {
    title:    "Global",
    subtitle: "Master controls that affect the entire automation system",
    names:    ["automation_enabled", "email_sending_enabled"],
  },
  {
    title:    "On-Boarding",
    subtitle: "Controls for new employee onboarding flows",
    names:    ["gws_account_creation_enabled", "retry_on_update_enabled"],
  },
  {
    title:    "Access Approvals",
    subtitle: "Third-party access provisioning flows",
    names:    ["akamai_enabled"],
  },
  {
    title:    "Off-Boarding",
    subtitle: "Controls for departing employee offboarding flows",
    names:    ["gws_account_suspend_enabled", "data_transfer_enabled", "ad_disable_enabled", "m365_disable_enabled"],
  },
];

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
      className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-slate-50/80 ${
        isMaster && toggle.value ? "bg-blue-50/30" : ""
      }`}
    >
      {/* Icon */}
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
        style={{ background: accent + "18" }}
      >
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">
            {TOGGLE_LABELS[toggle.name] ?? toggle.name}
          </span>
          {isMaster && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" /> Master switch
            </span>
          )}
        
        </div>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{DESCRIPTIONS[toggle.name]}</p>
        {toggle.lastChangedAt && (
          <p className="mt-1 text-[11px] text-slate-400">
            Last changed {formatIST(toggle.lastChangedAt)}
            {toggle.lastChangedBy ? ` by ${toggle.lastChangedBy}` : ""}
          </p>
        )}

        {/* Confirm inline */}
        {confirmOpen && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-700 font-medium flex-1">
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

function SettingsSkeleton() {
  return (
    <div className="px-8 py-6 space-y-6 max-w-3xl">
      {SECTIONS.map(({ title, names }) => (
        <div key={title} className="rounded-xl bg-white shadow-sm overflow-hidden">
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

export function Settings() {
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

  return (
    <div className="min-h-full bg-slate-50">
      {/* Page header */}
      <div className="border-b bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Toggle automation features on or off. Changes take effect immediately.
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <SettingsSkeleton />
      ) : isError ? (
        <div className="px-8 py-6"><ErrorState error={error as Error} /></div>
      ) : (
      <div className="px-4 py-4 space-y-4 max-w-3xl">
        {SECTIONS.map(({ title, subtitle, names }) => (
          <div key={title} className="rounded-xl border bg-white shadow-sm overflow-hidden">
            {/* Section header */}
            <div className="px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>

            {/* Toggle rows */}
            <div className="divide-y divide-slate-100">
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
      )}
    </div>
  );
}
