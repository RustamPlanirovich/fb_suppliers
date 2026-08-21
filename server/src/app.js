// Сборка Express-приложения: middleware → роутеры → 404 → обработчик ошибок.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import rateLimit from 'express-rate-limit';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { redis } from './utils/redis.js';
import { AppError, fromDbError } from './utils/errors.js';
import { BODY_LIMIT, PROJECT, RATE_LIMIT } from './utils/constants.js';
import { authRouter } from './components/auth/auth.router.js';
import { suppliersRouter } from './components/suppliers/suppliers.router.js';
import { catalogRouter } from './components/catalog/catalog.router.js';
import { offersRouter, marketRouter } from './components/catalog/offers.router.js';
import { arbitrageRouter } from './components/arbitrage/arbitrage.router.js';
import { categoriesRouter, tagsRouter } from './components/categories/categories.router.js';
import { moderationRouter } from './components/moderation/moderation.router.js';
import { flagsRouter } from './components/flags/flags.router.js';
import { usersRouter } from './components/users/users.router.js';
import { subscriptionsRouter } from './components/subscriptions/subscriptions.router.js';
import { promotionsRouter } from './components/promotions/promotions.router.js';
import { contentRouter } from './components/content/content.router.js';
import { broadcastsRouter } from './components/broadcasts/broadcasts.router.js';
import { analyticsRouter } from './components/analytics/analytics.router.js';
import { ioRouter } from './components/io/io.router.js';
import { funpayRouter } from './components/funpay/funpay.router.js';

const SESSION_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

// Админка лежит рядом с бэкендом и отдаётся тем же процессом: одному домену — один порт,
// а запросы к /api идут на тот же origin, поэтому CORS не нужен.
const ADMIN_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../admin/src');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  // Админка не использует внешних источников: политика максимально узкая.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  if (config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins, credentials: true }));
  }
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(session({
    store: new RedisStore({ client: redis, prefix: `${PROJECT}:sess:` }),
    secret: config.sessionSecret,
    name: `${PROJECT}.sid`,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.env === 'production',
      maxAge: SESSION_MAX_AGE_MS,
    },
  }));
  app.use('/api', rateLimit({ ...RATE_LIMIT.API, standardHeaders: true, legacyHeaders: false }));

  app.get('/health', (req, res) => res.json({ ok: true, data: { env: config.env } }));
  mountRouters(app);
  mountAdmin(app);

  app.use((req, res) => {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Маршрут не найден' } });
  });
  app.use(errorHandler);
  return app;
}

// Статика админки. Если папки нет (бэкенд выложен отдельно) — просто не монтируется.
function mountAdmin(app) {
  if (!fs.existsSync(path.join(ADMIN_DIR, 'index.html'))) return;
  app.use(express.static(ADMIN_DIR, { index: 'index.html', maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    return res.sendFile(path.join(ADMIN_DIR, 'index.html'));
  });
}

function mountRouters(app) {
  app.use('/api/auth', authRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/offers', offersRouter);
  app.use('/api/market', marketRouter);
  app.use('/api/arbitrage', arbitrageRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/moderation', moderationRouter);
  app.use('/api/flags', flagsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/promotions', promotionsRouter);
  app.use('/api/content', contentRouter);
  app.use('/api/broadcasts', broadcastsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/io', ioRouter);
  app.use('/api/funpay', funpayRouter);
}

// Наружу не уходят ни стектрейсы, ни тексты внутренних ошибок.
function errorHandler(err, req, res, next) {
  const mapped = err instanceof AppError ? err : fromDbError(err);
  const known = mapped instanceof AppError;
  if (known) err = mapped;
  if (!known) logger.error('Необработанная ошибка', { err: err.message, stack: err.stack });
  res.status(known ? err.status : 500).json({
    ok: false,
    error: {
      code: known ? err.code : 'INTERNAL',
      message: known ? err.message : 'Внутренняя ошибка сервера',
    },
  });
}
