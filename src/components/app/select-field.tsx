import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL_VALUE = "__all__";

export interface SelectFieldProps {
  options: { value: string; label: string }[];
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function SelectField({
  options,
  placeholder,
  value,
  onValueChange,
  className,
  disabled,
}: SelectFieldProps) {
  const items: Record<string, React.ReactNode> = {};
  if (placeholder) items[ALL_VALUE] = placeholder;
  for (const o of options) items[o.value] = o.label;

  return (
    <Select
      items={items}
      value={value || ALL_VALUE}
      onValueChange={(v) => onValueChange?.(v === ALL_VALUE ? "" : (v ?? ""))}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {placeholder && <SelectItem value={ALL_VALUE}>{placeholder}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
