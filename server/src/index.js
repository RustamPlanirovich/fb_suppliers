// Единственная входная точка: приложение + телеграм-бот + планировщик задач.
import { createApp } from './app.js';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { pool } from './utils/db.js';
import { redis } from './utils/redis.js';
import { Bot } from './components/bot/bot.js';
import { Scheduler } from './jobs/scheduler.js';
import { jobs } from './jobs/jobs.container.js';

const app = createApp();
const bot = new Bot();
const scheduler = new Scheduler(jobs);

const server = app.listen(config.port, () => {
  logger.info(`Сервер запущен на порту ${config.port}`, { env: config.env });
});

await bot.launch().catch((err) => logger.error('Бот не запустился', { err: err.message }));
scheduler.start();

// Graceful shutdown: без него pm2 reload рвёт живые запросы и соединения.
async function shutdown(signal) {
  logger.info(`Получен ${signal}, останавливаюсь`);
  scheduler.stop();
  bot.stop(signal);
  server.close(async () => {
    await pool.end().catch(() => {});
    redis.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
