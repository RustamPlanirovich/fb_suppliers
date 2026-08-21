const PERIOD_DAYS = { day: 1, week: 7, month: 30, quarter: 90, year: 365 };

export const PERIODS = Object.keys(PERIOD_DAYS);

// Период → интервал для SQL. Наружу отдаём число дней, в запрос уходит параметром.
export function periodDays(period) {
  return PERIOD_DAYS[period] ?? PERIOD_DAYS.month;
}
