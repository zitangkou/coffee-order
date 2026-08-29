const DEFAULT_TIMEZONE = "Asia/Shanghai";

interface CalendarParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function businessTimezone(): string {
  return process.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE;
}

function zonedParts(date: Date, timeZone = businessTimezone()): CalendarParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function shiftCalendarDate(parts: Pick<CalendarParts, "year" | "month" | "day">, days: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function zonedTimeToUtc(
  parts: Pick<CalendarParts, "year" | "month" | "day"> &
    Partial<Pick<CalendarParts, "hour" | "minute" | "second">>,
  millisecond = 0,
  timeZone = businessTimezone()
): Date {
  const target = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0,
    millisecond
  );
  let guess = target;
  // 两次修正足以处理常见时区及夏令时边界；第三次用于异常边界收敛。
  for (let i = 0; i < 3; i += 1) {
    const observed = zonedParts(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
      millisecond
    );
    const correction = target - observedAsUtc;
    if (correction === 0) break;
    guess += correction;
  }
  return new Date(guess);
}

export function businessDayRange(date = new Date()) {
  const local = zonedParts(date);
  const calendar = { year: local.year, month: local.month, day: local.day };
  const next = shiftCalendarDate(calendar, 1);
  const start = zonedTimeToUtc(calendar);
  const nextStart = zonedTimeToUtc(next);
  return { start, end: new Date(nextStart.getTime() - 1), calendar };
}

export function businessRange(unit: "today" | "week" | "month", date = new Date()) {
  const day = businessDayRange(date);
  if (unit === "today") return { start: day.start, end: day.end };
  let first = day.calendar;
  if (unit === "week") {
    const weekday = new Date(Date.UTC(first.year, first.month - 1, first.day)).getUTCDay();
    first = shiftCalendarDate(first, -((weekday + 6) % 7));
  } else {
    first = { ...first, day: 1 };
  }
  const start = zonedTimeToUtc(first);
  const nextDay = shiftCalendarDate(day.calendar, 1);
  const end = new Date(zonedTimeToUtc(nextDay).getTime() - 1);
  return { start, end };
}

export function businessHour(date: Date): number {
  return zonedParts(date).hour;
}

export function businessDateLabel(date: Date): string {
  const parts = zonedParts(date);
  return `${parts.month}/${parts.day}`;
}

export function shiftBusinessDate(date: Date, days: number): Date {
  const current = businessDayRange(date).calendar;
  return zonedTimeToUtc(shiftCalendarDate(current, days));
}
