// Расписание фоновых задач: имя → период в минутах. Значения тут, а не по коду.
export const JOB_SCHEDULE = {
  variantStats: 15,
  arbitrage: 30,
  alerts: 20,
  flags: 60,
  subscriptions: 60,
  broadcasts: 1,
  sourceSync: 180,
};

export const JOB_START_DELAY_MS = 15_000;
