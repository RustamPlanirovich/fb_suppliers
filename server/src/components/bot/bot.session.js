import { redis } from '../../utils/redis.js';
import { CACHE_TTL, REDIS_KEYS, BOT_STATE } from '../../utils/constants.js';

// Пользователь и его доступ подгружаются один раз на апдейт.
// Короткое состояние диалога (ждём текст жалобы и т.п.) живёт в Redis с TTL.
export class BotSession {
  #users;
  #access;

  constructor(users, access) {
    this.#users = users;
    this.#access = access;
  }

  middleware() {
    return async (ctx, next) => {
      const from = ctx.from;
      if (!from) return next();
      const user = await this.#users.upsertFromTelegram({
        telegramId: from.id,
        username: from.username ?? null,
        language: from.language_code ?? null,
      });
      if (user.is_blocked) return;
      ctx.state.user = user;
      ctx.state.access = await this.#access.forUser(user.id);
      return next();
    };
  }

  async setState(telegramId, state, payload = {}) {
    await redis.set(REDIS_KEYS.botState(telegramId), JSON.stringify({ state, payload }),
      'EX', CACHE_TTL.MEDIUM);
  }

  async getState(telegramId) {
    const raw = await redis.get(REDIS_KEYS.botState(telegramId));
    return raw ? JSON.parse(raw) : { state: BOT_STATE.IDLE, payload: {} };
  }

  async clearState(telegramId) {
    await redis.del(REDIS_KEYS.botState(telegramId));
  }
}
