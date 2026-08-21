import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { writeAudit, diff } from '../../utils/audit.js';
import { normalizePaging, paged } from '../../utils/pagination.js';
import { normalizePhone, normalizeTelegram, normalizeDomain } from '../../utils/text.js';
import { MARKETPLACE_SOURCES, SUPPLIER_STATUS } from '../../utils/constants.js';
import { EDITABLE_FIELDS, CONTACT_FIELDS } from './suppliers.fields.js';

export class SuppliersService {
  #repo;
  #stats;

  constructor(repo, stats) {
    this.#repo = repo;
    this.#stats = stats;
  }

  async list(filters, pagingInput) {
    const paging = normalizePaging(pagingInput);
    const { rows, total } = await this.#repo.list(filters, paging);
    return paged(rows.map(({ total_count: _, ...row }) => row), total, paging);
  }

  async getById(id) {
    const supplier = await this.#repo.findById(id);
    if (!supplier) throw new NotFoundError('Поставщик не найден');
    return { ...supplier, tags: await this.#repo.tags(id) };
  }

  async create(input, actorId) {
    const data = this.#prepare(input);
    const supplier = await this.#repo.create(data);
    if (input.tagIds) await this.#repo.setTags(supplier.id, input.tagIds);
    await writeAudit({
      adminId: actorId, entity: 'supplier', entityId: supplier.id, action: 'create',
      changes: diff({}, data, EDITABLE_FIELDS), comment: input.evidence ?? null,
    });
    return supplier;
  }

  async update(id, input, actorId) {
    const before = await this.getById(id);
    const data = this.#prepare(input, before.source);
    const supplier = await this.#repo.update(id, data);
    if (!supplier) throw new NotFoundError('Поставщик не найден');
    if (input.tagIds) await this.#repo.setTags(id, input.tagIds);
    await writeAudit({
      adminId: actorId, entity: 'supplier', entityId: id, action: 'update',
      changes: diff(before, data, EDITABLE_FIELDS), comment: input.evidence ?? null,
    });
    return supplier;
  }

  // Подтверждение проверки: фиксируем сотрудника и дату.
  async confirmCheck(id, { status = SUPPLIER_STATUS.VERIFIED, comment } = {}, actorId) {
    const supplier = await this.#repo.markChecked(id, actorId, status);
    if (!supplier) throw new NotFoundError('Поставщик не найден');
    await writeAudit({
      adminId: actorId, entity: 'supplier', entityId: id, action: 'check',
      changes: { status: { to: status } }, comment: comment ?? null,
    });
    return supplier;
  }

  async refreshStats(id) {
    return this.#stats.refresh(id);
  }

  async remove(id, actorId) {
    if (!(await this.#repo.remove(id))) throw new NotFoundError('Поставщик не найден');
    await writeAudit({ adminId: actorId, entity: 'supplier', entityId: id, action: 'delete' });
  }

  // Нормализация контактов + запрет хранить контакты для источников-площадок.
  #prepare(input, currentSource) {
    const data = { ...input };
    if (data.phone !== undefined) data.phone = normalizePhone(data.phone);
    if (data.telegram !== undefined) data.telegram = normalizeTelegram(data.telegram);
    if (data.website !== undefined) data.website = normalizeDomain(data.website);
    if (data.email !== undefined) data.email = data.email ? String(data.email).toLowerCase() : null;

    const source = data.source ?? currentSource;
    if (MARKETPLACE_SOURCES.includes(source)) {
      const filled = CONTACT_FIELDS.filter((field) => data[field]);
      if (filled.length) {
        throw new ValidationError(
          'Для карточек с площадки контакты не хранятся: она используется как источник цен',
        );
      }
      for (const field of CONTACT_FIELDS) if (field in data) delete data[field];
    }
    return data;
  }
}
