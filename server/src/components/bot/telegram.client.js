import { Telegraf } from 'telegraf';
import { config } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'bot' });

// Единственный экземпляр Telegraf на процесс. Если токена нет — бот не создаётся,
// а зависящие от него функции (рассылки, алерты) сообщают об этом явной ошибкой.
export const telegraf = config.telegram.enabled && config.telegram.token
  ? new Telegraf(config.telegram.token)
  : null;

if (!telegraf) log.warn('Телеграм-бот отключён: не задан TELEGRAM_BOT_TOKEN или BOT_ENABLED=off');
