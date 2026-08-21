import { query } from '../../utils/db.js';
import { ValidationError } from '../../utils/errors.js';

// Применение разобранных строк: отдельный метод на каждую цель импорта.
export class ImportRowsApplier {
  #suppliersService;
  #catalogService;
  #offersService;

  constructor({ suppliersService, catalogService, offersService }) {
    this.#suppliersService = suppliersService;
    this.#catalogService = catalogService;
    this.#offersService = offersService;
  }

  async apply(target, items, adminId) {
    if (target === 'suppliers') return this.#applySuppliers(items, adminId);
    if (target === 'offers') return this.#applyOffers(items, adminId);
    throw new ValidationError('Неизвестная цель импорта');
  }

  async #applySuppliers(items, adminId) {
    const result = { created: 0, updated: 0, skipped: 0 };
    for (const item of items) {
      if (!item.name) { result.skipped += 1; continue; }
      const existing = await this.#findSupplier(item);
      if (existing) {
        await this.#suppliersService.update(existing.id, this.#supplierPayload(item), adminId);
        result.updated += 1;
      } else {
        await this.#suppliersService.create(
          { ...this.#supplierPayload(item), source: item.source ?? 'import' }, adminId);
        result.created += 1;
      }
    }
    return result;
  }

  #supplierPayload(item) {
    return {
      name: item.name,
      description: item.description ?? null,
      external_url: item.external_url ?? null,
      telegram: item.telegram ?? null,
      phone: item.phone ?? null,
      email: item.email ?? null,
      website: item.website ?? null,
      quality_score: item.quality_score ? Number(item.quality_score) : null,
      status: item.status ?? 'pending',
      evidence: 'Импорт файла',
    };
  }

  async #applyOffers(items, adminId) {
    const result = { created: 0, updated: 0, skipped: 0 };
    for (const item of items) {
      if (!item.supplier || !item.product) { result.skipped += 1; continue; }
      const supplier = await this.#findSupplierByName(item.supplier);
      if (!supplier) { result.skipped += 1; continue; }
      const { variant } = await this.#catalogService.resolveVariant({
        productName: item.product, variantName: item.variant,
      });
      const applied = await this.#upsertOffer(supplier.id, variant.id, item, adminId);
      result[applied] += 1;
    }
    return result;
  }

  async #upsertOffer(supplierId, variantId, item, adminId) {
    const { rows } = await query(
      'SELECT id FROM offers WHERE supplier_id = $1 AND variant_id = $2', [supplierId, variantId]);
    const price = item.price ? Number(String(item.price).replace(',', '.')) : null;
    if (rows[0]) {
      if (price != null) {
        await this.#offersService.setPrice(rows[0].id,
          { price, source: 'import', evidence: 'Импорт файла' }, adminId);
      }
      return 'updated';
    }
    await this.#offersService.create({
      supplierId, variantId, title: item.title ?? null, price,
      currency: item.currency ?? 'RUB',
      minQty: item.min_qty ? Number(item.min_qty) : 1,
      url: item.url ?? null, externalId: item.external_id ?? null,
      source: 'import', evidence: 'Импорт файла',
    }, adminId);
    return 'created';
  }

  // Дубли в файле относительно базы — показываются в предпросмотре до применения.
  async findDuplicates(target, items) {
    if (target !== 'suppliers') return [];
    const found = [];
    for (const item of items.slice(0, 200)) {
      const existing = await this.#findSupplier(item);
      if (existing) found.push({ name: item.name, matched_id: existing.id, matched_by: existing.matched_by });
    }
    return found;
  }

  async #findSupplier(item) {
    const { rows } = await query(
      `SELECT id,
              CASE WHEN $1::text IS NOT NULL AND telegram = $1 THEN 'telegram'
                   WHEN $2::text IS NOT NULL AND phone = $2 THEN 'phone'
                   WHEN $3::text IS NOT NULL AND email = $3 THEN 'email'
                   WHEN $4::text IS NOT NULL AND website = $4 THEN 'website'
                   ELSE 'name' END AS matched_by
       FROM suppliers
       WHERE merged_into_id IS NULL AND (
         ($1::text IS NOT NULL AND telegram = $1) OR
         ($2::text IS NOT NULL AND phone = $2) OR
         ($3::text IS NOT NULL AND email = $3) OR
         ($4::text IS NOT NULL AND website = $4) OR
         lower(name) = lower($5))
       LIMIT 1`,
      [item.telegram ?? null, item.phone ?? null, item.email ?? null,
        item.website ?? null, item.name ?? ''],
    );
    return rows[0] ?? null;
  }

  async #findSupplierByName(name) {
    const { rows } = await query(
      'SELECT id FROM suppliers WHERE lower(name) = lower($1) AND merged_into_id IS NULL LIMIT 1',
      [name]);
    return rows[0] ?? null;
  }
}
