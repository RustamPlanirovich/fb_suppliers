import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';
import { normalizePaging, paged } from '../../utils/pagination.js';
import { QUEUES } from './moderation.queues.js';

// Очереди модерации: отзывы, жалобы, подтверждения сделок, пользовательские правки.
export class ModerationService {
  #repo;
  #stats;
  #applier;

  constructor(repo, stats, applier) {
    this.#repo = repo;
    this.#stats = stats;
    this.#applier = applier;
  }

  async list(queueName, filters, pagingInput) {
    this.#requireQueue(queueName);
    const paging = normalizePaging(pagingInput);
    const { rows, total } = await this.#repo.list(queueName, filters, paging);
    return paged(rows, total, paging);
  }

  async counts() {
    return this.#repo.counts();
  }

  async resolve(queueName, id, { status, resolution }, adminId) {
    const queue = this.#requireQueue(queueName);
    if (!queue.statuses.includes(status)) throw new ValidationError('Недопустимый статус');
    const record = await this.#repo.findById(queueName, id);
    if (!record) throw new NotFoundError('Запись не найдена');

    const updated = await this.#repo.resolve(queueName, id, { status, resolution, adminId });
    const applied = await this.#applyIfNeeded(queueName, updated, status, adminId);
    if (updated.supplier_id) await this.#stats.refresh(updated.supplier_id);

    await writeAudit({
      adminId, entity: queueName, entityId: id, action: 'resolve',
      changes: { status: { from: record.status, to: status } }, comment: resolution ?? null,
    });
    return { ...updated, applied };
  }

  async #applyIfNeeded(queueName, record, status, adminId) {
    const approved = status === 'approved';
    if (!approved || queueName !== 'submissions') return null;
    return this.#applier.apply(record, adminId);
  }

  #requireQueue(name) {
    const queue = QUEUES[name];
    if (!queue) throw new ValidationError('Неизвестная очередь модерации');
    return queue;
  }
}
