import { PROJECT } from './common.js';

export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 600,
  LONG: 3600,
  DAY: 86_400,
};

// Ключи Redis: `проект:сущность:идентификатор`
export const REDIS_KEYS = {
  session: (id) => `${PROJECT}:sess:${id}`,
  dashboard: (period) => `${PROJECT}:dashboard:${period}`,
  search: (hash) => `${PROJECT}:search:${hash}`,
  searchQuota: (userId, day) => `${PROJECT}:quota:${userId}:${day}`,
  botState: (telegramId) => `${PROJECT}:botstate:${telegramId}`,
  importPreview: (jobId) => `${PROJECT}:import:${jobId}`,
  broadcastLock: (id) => `${PROJECT}:broadcast:lock:${id}`,
  content: () => `${PROJECT}:content:all`,
};
