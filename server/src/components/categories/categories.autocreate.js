import { query } from '../../utils/db.js';
import { slugify } from '../../utils/text.js';

// Раздел площадки даёт готовую пару «игра → раздел», из которой строится дерево категорий:
// «Spotify» → «Premium». Иначе категории пришлось бы заводить руками под каждый источник.
export class CategoriesAutocreate {
  async ensure({ gameName, nodeName }) {
    if (!gameName) return null;
    const parent = await this.#upsert(gameName, null);
    if (!nodeName) return parent;
    return this.#upsert(nodeName, parent);
  }

  async #upsert(name, parent) {
    const slug = slugify(`${parent ? `${parent.slug}-` : ''}${name}`);
    const { rows } = await query(
      `INSERT INTO categories (parent_id, name, slug, path, depth)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE SET name = excluded.name
       RETURNING id, name, slug, path, depth`,
      [parent?.id ?? null, name, slug, `${parent ? parent.path : ''}${slug}/`,
        parent ? parent.depth + 1 : 0],
    );
    return rows[0];
  }
}
