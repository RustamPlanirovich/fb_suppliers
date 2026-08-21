import { ProxyAgent } from 'undici';
import { logger } from './logger.js';

const log = logger.child({ component: 'proxy' });
const agents = new Map();

// Часть площадок блокирует IP дата-центров по географии. Тогда запросы к источнику
// направляются через прокси, заданный в конфигурации; без него всё идёт напрямую.
export function proxyDispatcher(proxyUrl) {
  if (!proxyUrl) return undefined;
  if (!agents.has(proxyUrl)) {
    try {
      agents.set(proxyUrl, new ProxyAgent(proxyUrl));
      log.info('Источник ходит через прокси', { proxy: maskProxy(proxyUrl) });
    } catch (err) {
      log.error('Не удалось настроить прокси, работаю напрямую', { err: err.message });
      agents.set(proxyUrl, undefined);
    }
  }
  return agents.get(proxyUrl);
}

// В логи не должен попадать логин с паролем из адреса прокси.
function maskProxy(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return 'указан';
  }
}
