import { withTransaction } from '../../utils/db.js';
import { ValidationError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';
import { DUPLICATE_FIELDS, PAGE_SIZE } from '../../utils/constants.js';

export class SuppliersDuplicatesService {
  #repo;
  #stats;

  constructor(repo, stats) {
    this.#repo = repo;
    this.#stats = stats;
  }

  async find({ fields, limit } = {}) {
    const selected = (fields?.length ? fields : DUPLICATE_FIELDS)
      .filter((field) => DUPLICATE_FIELDS.includes(field));
    const perField = Math.min(PAGE_SIZE.MAX, Number(limit) || PAGE_SIZE.DEFAULT);
    const groups = await Promise.all(selected.map((field) => this.#repo.groups(field, perField)));
    return groups.flat();
  }

  // Объединение двух карточек: всё переносится на target, source уходит в архив.
  async merge({ targetId, sourceId }, actorId) {
    if (Number(targetId) === Number(sourceId)) {
      throw new ValidationError('Нельзя объединить карточку саму с собой');
    }
    await withTransaction((client) => this.#repo.merge(Number(targetId), Number(sourceId), client));
    await this.#stats.refresh(targetId);
    await writeAudit({
      adminId: actorId, entity: 'supplier', entityId: Number(targetId), action: 'merge',
      changes: { merged_from: Number(sourceId) },
    });
    return { targetId: Number(targetId), sourceId: Number(sourceId) };
  }
}
