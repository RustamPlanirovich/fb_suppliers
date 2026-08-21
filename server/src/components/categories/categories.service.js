import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';
import { slugify } from '../../utils/text.js';

export class CategoriesService {
  #repo;

  constructor(repo) {
    this.#repo = repo;
  }

  // Плоский список превращается в дерево на сервере — админке и боту оно нужно уже готовым.
  async tree() {
    const rows = await this.#repo.all();
    const byId = new Map(rows.map((row) => [Number(row.id), { ...row, children: [] }]));
    const roots = [];
    for (const node of byId.values()) {
      const parent = node.parent_id ? byId.get(Number(node.parent_id)) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async create(input, actorId) {
    const parent = input.parentId ? await this.#require(input.parentId) : null;
    const slug = await this.#uniqueSlug(`${parent ? `${parent.slug}-` : ''}${input.name}`);
    const category = await this.#repo.create({
      ...input,
      slug,
      path: `${parent ? parent.path : ''}${slug}/`,
      depth: parent ? parent.depth + 1 : 0,
    });
    await writeAudit({ adminId: actorId, entity: 'category', entityId: category.id,
      action: 'create', changes: { name: input.name, parent_id: input.parentId ?? null } });
    return category;
  }

  async update(id, input, actorId) {
    const category = await this.#repo.update(id, input);
    if (!category) throw new NotFoundError('Категория не найдена');
    await writeAudit({ adminId: actorId, entity: 'category', entityId: id, action: 'update',
      changes: input });
    return category;
  }

  async move(id, parentId, actorId) {
    const category = await this.#require(id);
    const parent = parentId ? await this.#require(parentId) : null;
    if (parent && parent.path.startsWith(category.path)) {
      throw new ValidationError('Нельзя перенести категорию внутрь её же поддерева');
    }
    const newPath = `${parent ? parent.path : ''}${category.slug}/`;
    await this.#repo.move(id, parentId ?? null, newPath, parent ? parent.depth + 1 : 0,
      category.path);
    await writeAudit({ adminId: actorId, entity: 'category', entityId: id, action: 'move',
      changes: { parent_id: { from: category.parent_id, to: parentId ?? null } } });
    return this.#require(id);
  }

  async remove(id, actorId) {
    if (!(await this.#repo.remove(id))) throw new NotFoundError('Категория не найдена');
    await writeAudit({ adminId: actorId, entity: 'category', entityId: id, action: 'delete' });
  }

  // Slug уникален: при совпадении названий добавляется числовой суффикс.
  async #uniqueSlug(source) {
    const base = slugify(source);
    const taken = await this.#repo.all();
    const slugs = new Set(taken.map((row) => row.slug));
    if (!slugs.has(base)) return base;
    let index = 2;
    while (slugs.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
  }

  async #require(id) {
    const category = await this.#repo.findById(id);
    if (!category) throw new NotFoundError('Категория не найдена');
    return category;
  }
}
