export type DateRange = {
  start: string;
  end: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [yearRaw, monthRaw, dayRaw] = dateStr.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

export function weekRangeMondaySunday(dateStr: string): DateRange {
  const current = parseLocalDate(dateStr);
  const mondayOffset = (current.getDay() + 6) % 7;
  const monday = addDays(current, -mondayOffset);
  const sunday = addDays(monday, 6);

  return {
    start: formatLocalDate(monday),
    end: formatLocalDate(sunday),
  };
}

export function monthRangeCalendar(dateStr: string): DateRange {
  const current = parseLocalDate(dateStr);
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
  const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

  return {
    start: formatLocalDate(monthStart),
    end: formatLocalDate(monthEnd),
  };
}

export function weekIdentifier(dateStr: string): string {
  const current = parseLocalDate(dateStr);
  const mondayIndex = (current.getDay() + 6) % 7;
  const thursday = addDays(current, 3 - mondayIndex);
  const weekYear = thursday.getFullYear();

  const jan4 = new Date(weekYear, 0, 4);
  const jan4MondayIndex = (jan4.getDay() + 6) % 7;
  const firstThursday = addDays(jan4, 3 - jan4MondayIndex);
  const weeksSinceFirst = Math.round(
    (startOfDay(thursday).getTime() - startOfDay(firstThursday).getTime()) / 604800000
  );

  return `${weekYear}_W${pad2(weeksSinceFirst + 1)}`;
}

export function monthIdentifier(dateStr: string): string {
  const current = parseLocalDate(dateStr);
  return `${current.getFullYear()}_M${pad2(current.getMonth() + 1)}`;
}
