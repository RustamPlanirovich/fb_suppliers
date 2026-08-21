import { redis } from '../../utils/redis.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';
import { paged, normalizePaging } from '../../utils/pagination.js';
import { BOT_LIMITS, REDIS_KEYS, CACHE_TTL } from '../../utils/constants.js';

const log = logger.child({ component: 'broadcasts' });
const BATCH = 100;

// Рассылки: сегмент → тестовая отправка → запуск с ограничением скорости.
// Массовая отправка требует явного подтверждения, чтобы не разослать всем случайно.
export class BroadcastsService {
  #repo;
  #users;
  #sender;

  constructor(repo, users, sender) {
    this.#repo = repo;
    this.#users = users;
    this.#sender = sender;
  }

  async list(pagingInput) {
    const paging = normalizePaging(pagingInput);
    const { rows, total } = await this.#repo.list(paging);
    return paged(rows, total, paging);
  }

  async create(input, actorId) {
    const broadcast = await this.#repo.create({ ...input, createdBy: actorId });
    await writeAudit({ adminId: actorId, entity: 'broadcast', entityId: broadcast.id,
      action: 'create', changes: { title: input.title } });
    return broadcast;
  }

  async update(id, input, actorId) {
    const broadcast = await this.#repo.update(id, input);
    if (!broadcast) throw new ValidationError('Изменять можно только черновик или запланированную');
    await writeAudit({ adminId: actorId, entity: 'broadcast', entityId: id, action: 'update' });
    return broadcast;
  }

  // Оценка охвата до отправки — админ видит цифру и подтверждает её.
  async estimate(id) {
    const broadcast = await this.#require(id);
    const audience = await this.#users.segment(broadcast.segment ?? {}, 100_000);
    return { total: audience.length, needsConfirm: audience.length >= BOT_LIMITS.BROADCAST_CONFIRM_THRESHOLD };
  }

  async testSend(id, telegramId) {
    const broadcast = await this.#require(id);
    await this.#sender.send(telegramId, broadcast);
    return { sent: true };
  }

  async schedule(id, scheduledAt, actorId) {
    await this.#require(id);
    const broadcast = await this.#repo.update(id, { scheduledAt });
    await this.#repo.setStatus(id, 'scheduled');
    await writeAudit({ adminId: actorId, entity: 'broadcast', entityId: id, action: 'schedule',
      changes: { scheduled_at: scheduledAt } });
    return broadcast;
  }

  async cancel(id, actorId) {
    const broadcast = await this.#repo.setStatus(id, 'cancelled');
    if (!broadcast) throw new NotFoundError('Рассылка не найдена');
    await writeAudit({ adminId: actorId, entity: 'broadcast', entityId: id, action: 'cancel' });
    return broadcast;
  }

  async start(id, { confirmedTotal } = {}, actorId) {
    const broadcast = await this.#require(id);
    if (!['draft', 'scheduled'].includes(broadcast.status)) {
      throw new ValidationError('Рассылка уже запущена или завершена');
    }
    const audience = await this.#users.segment(broadcast.segment ?? {}, 100_000);
    this.#assertConfirmed(audience.length, confirmedTotal);

    await this.#repo.enqueue(id, audience.map((row) => Number(row.id)));
    await this.#repo.setStatus(id, 'sending', { totalCount: audience.length });
    await writeAudit({ adminId: actorId, entity: 'broadcast', entityId: id, action: 'start',
      changes: { total: audience.length } });

    this.#run(id).catch((err) => log.error('Рассылка упала', { id, err: err.message }));
    return { queued: audience.length };
  }

  #assertConfirmed(total, confirmedTotal) {
    if (total === 0) throw new ValidationError('В сегменте нет получателей');
    if (total < BOT_LIMITS.BROADCAST_CONFIRM_THRESHOLD) return;
    if (Number(confirmedTotal) !== total) {
      throw new ValidationError(
        `Массовая рассылка на ${total} получателей: передайте confirmedTotal = ${total}`,
      );
    }
  }

  // Фоновая отправка порциями с паузой — не упираемся в лимиты Telegram.
  async #run(id) {
    const lockKey = REDIS_KEYS.broadcastLock(id);
    if (await redis.set(lockKey, '1', 'EX', CACHE_TTL.LONG, 'NX') !== 'OK') return;
    try {
      const broadcast = await this.#require(id);
      let batch = await this.#repo.pending(id, BATCH);
      while (batch.length) {
        await this.#sendBatch(broadcast, batch);
        await this.#repo.refreshCounters(id);
        batch = await this.#repo.pending(id, BATCH);
      }
      await this.#repo.setStatus(id, 'sent');
    } finally {
      await redis.del(lockKey);
    }
  }

  async #sendBatch(broadcast, batch) {
    const perSecond = BOT_LIMITS.BROADCAST_RATE_PER_SEC;
    for (const [index, delivery] of batch.entries()) {
      try {
        await this.#sender.send(delivery.telegram_id, broadcast);
        await this.#repo.markDelivery(delivery.id, 'sent');
      } catch (err) {
        const blocked = /blocked|deactivated|chat not found/i.test(err.message ?? '');
        await this.#repo.markDelivery(delivery.id, blocked ? 'blocked' : 'failed', err.message);
      }
      if ((index + 1) % perSecond === 0) await this.#pause(1000);
    }
  }

  #pause(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
  }

  // Запуск отложенных рассылок — вызывается планировщиком.
  async runDue() {
    const ids = await this.#repo.dueScheduled();
    for (const id of ids) {
      const estimate = await this.estimate(id);
      await this.start(id, { confirmedTotal: estimate.total }, null).catch((err) =>
        log.error('Не удалось запустить отложенную рассылку', { id, err: err.message }));
    }
    return { started: ids.length };
  }

  async #require(id) {
    const broadcast = await this.#repo.findById(id);
    if (!broadcast) throw new NotFoundError('Рассылка не найдена');
    return broadcast;
  }
}
