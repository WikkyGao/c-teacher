export type CalendarMode = "month" | "week" | "day";

export type CalendarRange = {
  start: number;
  end: number;
};

export type MonthCell = CalendarRange & {
  key: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
};

export function startOfDay(value: number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfWeek(value: number) {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfMonth(value: number) {
  const date = new Date(value);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function addDays(value: number, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function addMonths(value: number, months: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date.getTime();
}

export function dayKey(value: number) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function visibleRangeForMode(mode: CalendarMode, anchor: number): CalendarRange {
  if (mode === "day") {
    const start = startOfDay(anchor);
    return { start, end: addDays(start, 1) };
  }
  if (mode === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfMonth(anchor);
  const end = addMonths(start, 1);
  return { start, end };
}

export function buildMonthCells(anchor: number): MonthCell[] {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const nextMonthStart = addMonths(monthStart, 1);
  const gridEnd = startOfWeek(addDays(nextMonthStart, 6));
  const todayKey = dayKey(Date.now());
  const cells: MonthCell[] = [];

  for (let cursor = gridStart; cursor < gridEnd; cursor = addDays(cursor, 1)) {
    const date = new Date(cursor);
    cells.push({
      key: dayKey(cursor),
      dayNumber: date.getDate(),
      start: cursor,
      end: addDays(cursor, 1),
      inCurrentMonth: cursor >= monthStart && cursor < nextMonthStart,
      isToday: dayKey(cursor) === todayKey
    });
  }

  return cells;
}

export function shiftCalendarAnchor(mode: CalendarMode, anchor: number, direction: -1 | 1) {
  if (mode === "day") return addDays(anchor, direction);
  if (mode === "week") return addDays(anchor, direction * 7);
  return addMonths(anchor, direction);
}

export function calendarTitle(mode: CalendarMode, anchor: number) {
  if (mode === "month") {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long"
    }).format(new Date(anchor));
  }
  if (mode === "day") {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    }).format(new Date(anchor));
  }
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const startText = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(start));
  const endText = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(end));
  return `${startText} - ${endText}`;
}
