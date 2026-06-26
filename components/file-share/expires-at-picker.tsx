import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export const maxExpiresMs = 30 * 24 * 60 * 60 * 1000;

export type DurationUnit = "minute" | "hour" | "day" | "week" | "month";

const durationUnits: Array<{ value: DurationUnit; label: string; ms: number }> = [
  { value: "minute", label: "分钟", ms: 60 * 1000 },
  { value: "hour", label: "小时", ms: 60 * 60 * 1000 },
  { value: "day", label: "天", ms: 24 * 60 * 60 * 1000 },
  { value: "week", label: "周", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "month", label: "月", ms: 30 * 24 * 60 * 60 * 1000 },
];

export function roundToMinute(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);

  return next;
}

export function durationToExpiresAt(amount: number, unit: DurationUnit) {
  const unitConfig = durationUnits.find((item) => item.value === unit);
  const expiresAt = roundToMinute(
    new Date(Date.now() + Math.max(1, amount) * (unitConfig?.ms ?? durationUnits[2].ms))
  );

  if (expiresAt.getTime() <= Date.now()) {
    expiresAt.setMinutes(expiresAt.getMinutes() + 1);
  }

  return expiresAt;
}

function durationUnitLabel(unit: DurationUnit) {
  return durationUnits.find((item) => item.value === unit)?.label ?? "天";
}

export function maxAmountForUnit(unit: DurationUnit) {
  const unitConfig = durationUnits.find((item) => item.value === unit);

  return Math.max(1, Math.floor(maxExpiresMs / (unitConfig?.ms ?? durationUnits[2].ms)));
}

export function ExpiresAtPicker({
  durationAmount,
  durationUnit,
  expiresAtDate,
  today,
  maxDate,
  onDurationChange,
  onDateChange,
}: {
  durationAmount: string;
  durationUnit: DurationUnit;
  expiresAtDate: Date;
  today: Date;
  maxDate: Date;
  onDurationChange: (nextAmount: string, nextUnit: DurationUnit) => void;
  onDateChange: (nextDate: Date | undefined) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarIcon className="size-4 text-muted-foreground" />
        <Label>过期时间</Label>
      </div>
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={maxAmountForUnit(durationUnit)}
              step={1}
              value={durationAmount}
              onChange={(event) => onDurationChange(event.target.value, durationUnit)}
              aria-label="过期时长"
              className="h-9 w-24 text-center"
            />
            <Select
              value={durationUnit}
              onValueChange={(value) =>
                onDurationChange(durationAmount, value as DurationUnit)
              }
            >
              <SelectTrigger className="h-9 w-28">
                <span className="flex-1 text-left">
                  {durationUnitLabel(durationUnit)}
                </span>
              </SelectTrigger>
              <SelectContent>
                {durationUnits.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            快捷设置，到期自动失效
          </div>
        </div>
      </div>

      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full justify-start font-normal"
            />
          }
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {format(expiresAtDate, "yyyy年MM月dd日 HH:mm", { locale: zhCN })}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <Calendar
            mode="single"
            selected={expiresAtDate}
            onSelect={onDateChange}
            locale={zhCN}
            disabled={{ before: today, after: maxDate }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
