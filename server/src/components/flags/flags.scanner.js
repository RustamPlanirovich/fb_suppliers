import { query } from '../../utils/db.js';
import { FLAG_THRESHOLDS } from '../../utils/constants.js';

// Периодический скан данных: что просрочено, что не обновлялось, где много жалоб.
// Каждый вид проверки — отдельный приватный метод, чтобы не разрастаться в простыню.
export class FlagsScanner {
  #repo;

  constructor(repo) {
    this.#repo = repo;
  }

  async run() {
    const results = await Promise.all([
      this.#stalePrices(),
      this.#staleSupplierChecks(),
      this.#manyComplaints(),
      this.#removedOffers(),
    ]);
    return { raised: results.reduce((sum, count) => sum + count, 0) };
  }

  async #stalePrices() {
    const { rows } = await query(
      `SELECT o.id, o.price_checked_at FROM offers o
       WHERE o.is_active AND o.price_checked_at < now() - make_interval(days => $1) LIMIT 500`,
      [FLAG_THRESHOLDS.PRICE_STALE_DAYS],
    );
    return this.#raiseAll(rows, 'offer', 'price_stale', 'warning',
      (row) => ({ price_checked_at: row.price_checked_at }));
  }

  // Карточка считается просроченной, если её давно не проверяли ИЛИ если она давно заведена
  // и не проверялась ни разу. Только что импортированные карточки очередь не засоряют.
  async #staleSupplierChecks() {
    const { rows } = await query(
      `SELECT id, checked_at FROM suppliers
       WHERE merged_into_id IS NULL AND status IN ('verified', 'recheck')
         AND CASE WHEN checked_at IS NULL
                  THEN created_at < now() - make_interval(days => $1)
                  ELSE checked_at < now() - make_interval(days => $1) END
       LIMIT 500`,
      [FLAG_THRESHOLDS.SUPPLIER_STALE_CHECK_DAYS],
    );
    return this.#raiseAll(rows, 'supplier', 'supplier_stale_check', 'warning',
      (row) => ({ checked_at: row.checked_at }));
  }

  async #manyComplaints() {
    const { rows } = await query(
      `SELECT supplier_id AS id, count(*)::int AS cnt FROM complaints
       WHERE status IN ('new', 'in_progress') GROUP BY supplier_id HAVING count(*) >= $1 LIMIT 500`,
      [FLAG_THRESHOLDS.COMPLAINTS_LIMIT],
    );
    return this.#raiseAll(rows, 'supplier', 'many_complaints', 'critical',
      (row) => ({ complaints: row.cnt }));
  }

  async #removedOffers() {
    const { rows } = await query(
      `SELECT id FROM offers WHERE NOT is_active AND updated_at > now() - interval '1 day' LIMIT 500`,
    );
    return this.#raiseAll(rows, 'offer', 'offer_removed', 'info', () => ({}));
  }

  async #raiseAll(rows, entity, type, severity, detailsOf) {
    for (const row of rows) {
      await this.#repo.raise({ entity, entityId: row.id, type, severity, details: detailsOf(row) });
    }
    return rows.length;
  }
}
