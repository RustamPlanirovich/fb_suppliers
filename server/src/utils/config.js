// Единственное место, где читается process.env. Валидация на старте: нет переменной — падаем сразу.
import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Отсутствует обязательная переменная окружения: ${name}`);
  return value;
}

function list(name) {
  return (process.env[name] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    database: required('PGDATABASE'),
    user: required('PGUSER'),
    password: required('PGPASSWORD'),
  },
  redis: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
  sessionSecret: required('SESSION_SECRET'),
  corsOrigins: list('CORS_ORIGINS'),
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN ?? '',
    enabled: process.env.BOT_ENABLED !== 'off',
  },
  funpay: {
    baseUrl: process.env.FUNPAY_BASE_URL ?? 'https://funpay.com',
    userAgent: process.env.FUNPAY_USER_AGENT
      ?? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    // Площадка отдаёт цены в валюте посетителя: без явной фиксации они приходят
    // то в рублях, то в евро, и расчёт маржи ломается.
    currency: (process.env.FUNPAY_CURRENCY ?? 'rub').toLowerCase(),
    enabled: process.env.FUNPAY_SYNC_ENABLED === 'on',
  },
};
