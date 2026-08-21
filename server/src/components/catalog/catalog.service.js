import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';
import { normalizePaging, paged } from '../../utils/pagination.js';
import { slugify } from '../../utils/text.js';

// Товары и их варианты. Товар — отдельная сущность, поставщик к ней прикрепляется оффером.
export class CatalogService {
  #products;
  #variants;
  #stats;

  constructor(products, variants, stats) {
    this.#products = products;
    this.#variants = variants;
    this.#stats = stats;
  }

  async listProducts(filters, pagingInput) {
    const paging = normalizePaging(pagingInput);
    const { rows, total } = await this.#products.list(filters, paging);
    return paged(rows, total, paging);
  }

  async getProduct(id) {
    const product = await this.#products.findById(id);
    if (!product) throw new NotFoundError('Товар не найден');
    const variants = await this.#variants.list({ productId: id }, { limit: 200, offset: 0 });
    return { ...product, variants: variants.rows };
  }

  // Два товара с одинаковым названием разводят варианты и портят агрегаты,
  // поэтому повтор — явная ошибка, а не молчаливое создание дубля.
  async createProduct(input, actorId) {
    const slug = slugify(input.name);
    const existing = await this.#products.findBySlug(slug);
    if (existing) {
      throw new ConflictError(`Товар «${existing.name}» уже есть — добавьте вариант к нему`);
    }
    const product = await this.#products.create({ ...input, slug });
    await writeAudit({ adminId: actorId, entity: 'product', entityId: product.id, action: 'create',
      changes: { name: { to: product.name } } });
    return product;
  }

  async updateProduct(id, input, actorId) {
    const product = await this.#products.update(id, input);
    if (!product) throw new NotFoundError('Товар не найден');
    await writeAudit({ adminId: actorId, entity: 'product', entityId: id, action: 'update',
      changes: input, comment: input.evidence ?? null });
    return product;
  }

  async removeProduct(id, actorId) {
    if (!(await this.#products.remove(id))) throw new NotFoundError('Товар не найден');
    await writeAudit({ adminId: actorId, entity: 'product', entityId: id, action: 'delete' });
  }

  async listVariants(filters, pagingInput) {
    const paging = normalizePaging(pagingInput);
    const { rows, total } = await this.#variants.list(filters, paging);
    return paged(rows, total, paging);
  }

  async getVariant(id) {
    const variant = await this.#variants.findById(id);
    if (!variant) throw new NotFoundError('Вариант не найден');
    return variant;
  }

  async createVariant(input, actorId) {
    const variant = await this.#variants.create(input);
    await writeAudit({ adminId: actorId, entity: 'variant', entityId: variant.id, action: 'create',
      changes: { product_id: input.productId, name: input.name } });
    return variant;
  }

  async updateVariant(id, input, actorId) {
    const variant = await this.#variants.update(id, input);
    if (!variant) throw new NotFoundError('Вариант не найден');
    await writeAudit({ adminId: actorId, entity: 'variant', entityId: id, action: 'update',
      changes: input, comment: input.evidence ?? null });
    return variant;
  }

  async removeVariant(id, actorId) {
    if (!(await this.#variants.remove(id))) throw new NotFoundError('Вариант не найден');
    await writeAudit({ adminId: actorId, entity: 'variant', entityId: id, action: 'delete' });
  }

  async refreshVariantStats(id) {
    return this.#stats.refresh(id);
  }

  // Импорт и парсер приходят с текстовыми названиями — здесь они превращаются в id.
  async resolveVariant({ productName, variantName, categoryId }) {
    const slug = slugify(productName);
    let product = await this.#products.findBySlug(slug);
    if (!product) {
      product = await this.#products.create({ name: productName, slug, categoryId });
    } else if (categoryId && !product.category_id) {
      // Товар мог быть создан до появления дерева категорий — доразмечаем при синхронизации.
      product = await this.#products.update(product.id, { categoryId });
    }
    const name = variantName || 'Базовый';
    const variant = (await this.#variants.findByName(product.id, name))
      ?? (await this.#variants.create({ productId: product.id, name }));
    return { product, variant };
  }

}
