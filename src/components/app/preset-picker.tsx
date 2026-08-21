import { Tabs, TabsList, TabsTab, TabsIndicator } from "@/components/ui/tabs";

// Built on the same shadcn Tabs primitive Settings.tsx's tab strip already
// uses (see components/ui/tabs.tsx) -- was previously a hand-rolled
// <button> group duplicating that exact segmented-control pattern with its
// own slightly different sizing (text-xs vs Tabs' own text-sm) and no
// sliding indicator, which is exactly the kind of inconsistency this was
// meant to fix. No TabsPanel here -- this is a plain filter control, not a
// tabbed content switcher, so only List/Indicator/Tab are needed.
export function PresetPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
      <TabsList>
        <TabsIndicator />
        {options.map((opt) => (
          <TabsTab key={opt.key} value={opt.key}>
            {opt.label}
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  );
}
