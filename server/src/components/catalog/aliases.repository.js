import { query } from '../../utils/db.js';
import { autoAliases, toAlias } from '../../utils/search.keys.js';

export class AliasesRepository {
  async list(productId) {
    const { rows } = await query(
      `SELECT id, alias, alias_key, source, created_at FROM product_aliases
       WHERE product_id = $1 ORDER BY source, alias`,
      [productId],
    );
    return rows;
  }

  async add(productId, text, source = 'manual', adminId = null) {
    const { alias, aliasNorm, aliasKey, aliasSkel } = toAlias(text);
    if (aliasKey.length < 2) return null;
    const { rows } = await query(
      `INSERT INTO product_aliases (product_id, alias, alias_norm, alias_key, alias_skel,
                                    source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (product_id, alias_key) DO UPDATE SET alias = excluded.alias
       RETURNING id, alias, alias_key, source`,
      [productId, alias, aliasNorm, aliasKey, aliasSkel, source, adminId],
    );
    return rows[0];
  }

  async remove(id) {
    const { rowCount } = await query(
      "DELETE FROM product_aliases WHERE id = $1 AND source <> 'auto'", [id]);
    return rowCount > 0;
  }

  // Автосинонимы пересобираются из названия: они служебные и правятся только кодом.
  async refreshAuto(productId, name) {
    const items = autoAliases(name);
    if (!items.length) return 0;
    await query("DELETE FROM product_aliases WHERE product_id = $1 AND source = 'auto'", [productId]);
    const { rowCount } = await query(
      `INSERT INTO product_aliases (product_id, alias, alias_norm, alias_key, alias_skel, source)
       SELECT $1, x.alias, x.norm, x.key, x.skel, 'auto'
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[]) AS x(alias, norm, key, skel)
       ON CONFLICT (product_id, alias_key) DO NOTHING`,
      [productId, items.map((i) => i.alias), items.map((i) => i.aliasNorm),
        items.map((i) => i.aliasKey), items.map((i) => i.aliasSkel)],
    );
    return rowCount;
  }

  // Разовая пересборка для товаров, заведённых до появления синонимов.
  async refreshAll() {
    const { rows } = await query('SELECT id, name FROM products');
    let total = 0;
    for (const row of rows) total += await this.refreshAuto(row.id, row.name);
    return { products: rows.length, aliases: total };
  }
}
