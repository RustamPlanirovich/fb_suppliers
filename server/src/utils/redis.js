// Единственный клиент Redis на процесс.
// Ключи: `проект:сущность:id` (фабрики в constants.js), кэш всегда с TTL.
import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

export const redis = new Redis(config.redis.url, { maxRetriesPerRequest: 2 });

redis.on('error', (err) => logger.error('Ошибка Redis', { err: err.message }));
