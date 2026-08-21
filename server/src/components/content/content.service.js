import { redis } from '../../utils/redis.js';
import { CACHE_TTL, REDIS_KEYS } from '../../utils/constants.js';
import { writeAudit } from '../../utils/audit.js';
import { NotFoundError } from '../../utils/errors.js';

// Тексты бота живут в БД и кэшируются: правка в админке видна без деплоя.
export class ContentService {
  #repo;

  constructor(repo) {
    this.#repo = repo;
  }

  async map() {
    const cached = await redis.get(REDIS_KEYS.content());
    if (cached) return JSON.parse(cached);
    const map = await this.#repo.activeMap();
    await redis.set(REDIS_KEYS.content(), JSON.stringify(map), 'EX', CACHE_TTL.MEDIUM);
    return map;
  }

  async text(key, fallback = '') {
    const map = await this.map();
    return map[key]?.body || fallback;
  }

  async all() {
    return this.#repo.all();
  }

  async upsert(input, actorId) {
    const block = await this.#repo.upsert({ ...input, updatedBy: actorId });
    await redis.del(REDIS_KEYS.content());
    await writeAudit({ adminId: actorId, entity: 'content', entityId: block.id, action: 'upsert',
      changes: { key: input.key } });
    return block;
  }

  async remove(key, actorId) {
    if (!(await this.#repo.remove(key))) throw new NotFoundError('Блок не найден');
    await redis.del(REDIS_KEYS.content());
    await writeAudit({ adminId: actorId, entity: 'content', entityId: null, action: 'delete',
      changes: { key } });
  }

  async faq(activeOnly) {
    return this.#repo.faq(activeOnly);
  }

  async createFaq(input, actorId) {
    const entry = await this.#repo.createFaq(input);
    await writeAudit({ adminId: actorId, entity: 'faq', entityId: entry.id, action: 'create' });
    return entry;
  }

  async updateFaq(id, input, actorId) {
    const entry = await this.#repo.updateFaq(id, input);
    if (!entry) throw new NotFoundError('Вопрос не найден');
    await writeAudit({ adminId: actorId, entity: 'faq', entityId: id, action: 'update' });
    return entry;
  }

  async removeFaq(id, actorId) {
    if (!(await this.#repo.removeFaq(id))) throw new NotFoundError('Вопрос не найден');
    await writeAudit({ adminId: actorId, entity: 'faq', entityId: id, action: 'delete' });
  }
}
