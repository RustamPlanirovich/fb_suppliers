import { ValidationError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';
import { BULK_LIMIT, SUPPLIER_STATUSES } from '../../utils/constants.js';

// Массовые действия админки: выделили N карточек — поменяли статус/категорию/скрытие и т.п.
export class SuppliersBulkService {
  #repo;

  constructor(repo) {
    this.#repo = repo;
  }

  async apply({ ids, action, value }, actorId) {
    const unique = [...new Set(ids.map(Number))].filter(Boolean);
    if (!unique.length) throw new ValidationError('Не выбрано ни одной записи');
    if (unique.length > BULK_LIMIT) {
      throw new ValidationError(`За одну операцию можно изменить не более ${BULK_LIMIT} записей`);
    }
    const affected = await this.#run(action, unique, value);
    await writeAudit({
      adminId: actorId, entity: 'supplier', entityId: null, action: `bulk_${action}`,
      changes: { ids: unique, value: value ?? null, affected },
    });
    return { affected, requested: unique.length };
  }

  async #run(action, ids, value) {
    switch (action) {
      case 'status':
        if (!SUPPLIER_STATUSES.includes(value)) throw new ValidationError('Неизвестный статус');
        return this.#repo.setStatus(ids, value);
      case 'category':
        return this.#repo.setCategory(ids, value ? Number(value) : null);
      case 'hide':
        return this.#repo.setHidden(ids, true);
      case 'show':
        return this.#repo.setHidden(ids, false);
      case 'assign_check':
        return this.#repo.assignCheck(ids);
      case 'add_tags':
        return this.#repo.addTags(ids, (value ?? []).map(Number));
      case 'delete':
        return this.#repo.remove(ids);
      default:
        throw new ValidationError('Неизвестное массовое действие');
    }
  }
}
