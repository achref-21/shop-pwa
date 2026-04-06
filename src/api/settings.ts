import { apiFetch } from "./client";

export type DailyLimitApiResponse = {
  today_payments_total: number;
  daily_limit: number;
};

export function getDailyLimitByDate(date: string) {
  return apiFetch<DailyLimitApiResponse>(
    `/settings/daily-limit/${encodeURIComponent(date)}`
  );
}

type SettingValueResponse = {
  name?: string;
  value?: unknown;
};

function parseDailyLimitValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function getDailyLimitSettingValue(): Promise<number | null> {
  const data = await apiFetch<SettingValueResponse>("/settings/daily_limit");
  return parseDailyLimitValue(data.value);
}

export async function setDailyLimitSettingValue(
  value: number | null
): Promise<number | null> {
  const data = await apiFetch<SettingValueResponse>("/settings/daily_limit", {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
  return parseDailyLimitValue(data.value);
}
