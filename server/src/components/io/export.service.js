import { query } from '../../utils/db.js';

// Выгрузка справочников. Набор колонок фиксирован — SQL не собирается из пользовательского ввода.
const EXPORTS = {
  suppliers: {
    headers: ['id', 'name', 'source', 'category', 'telegram', 'phone', 'email', 'website',
      'status', 'quality_score', 'reliability', 'reviews', 'complaints', 'deals_30d',
      'offers', 'checked_at', 'created_at'],
    sql: `SELECT s.id, s.name, s.source, c.name AS category, s.telegram, s.phone, s.email,
                 s.website, s.status, s.quality_score, s.score_reliability, s.reviews_count,
                 s.complaints_count, s.confirmed_deals_30d, s.offers_count, s.checked_at, s.created_at
          FROM suppliers s LEFT JOIN categories c ON c.id = s.category_id
          WHERE s.merged_into_id IS NULL ORDER BY s.id`,
  },
  offers: {
    headers: ['id', 'supplier', 'product', 'variant', 'title', 'price', 'currency', 'min_qty',
      'stock', 'url', 'is_active', 'price_checked_at'],
    sql: `SELECT o.id, s.name AS supplier, p.name AS product, v.name AS variant, o.title,
                 o.price, o.currency, o.min_qty, o.stock, o.url, o.is_active, o.price_checked_at
          FROM offers o
          JOIN suppliers s ON s.id = o.supplier_id
          JOIN product_variants v ON v.id = o.variant_id
          JOIN products p ON p.id = v.product_id
          ORDER BY o.id`,
  },
  arbitrage: {
    headers: ['product', 'variant', 'supplier', 'marketplace', 'buy', 'sell', 'profit', 'roi_pct',
      'margin_pct', 'risk', 'competition', 'mark'],
    sql: `SELECT p.name, v.name, s.name, m.name, a.buy_price, a.sell_price, a.profit, a.roi_pct,
                 a.margin_pct, a.risk_level, a.competition, a.admin_mark
          FROM arbitrage_links a
          JOIN offers o ON o.id = a.offer_id
          JOIN suppliers s ON s.id = o.supplier_id
          JOIN product_variants v ON v.id = a.variant_id
          JOIN products p ON p.id = v.product_id
          JOIN marketplaces m ON m.id = a.marketplace_id
          WHERE a.is_active ORDER BY a.roi_pct DESC`,
  },
};

export const EXPORT_TARGETS = Object.keys(EXPORTS);

export class ExportService {
  #writer;

  constructor(writer) {
    this.#writer = writer;
  }

  async build(target, format) {
    const config = EXPORTS[target];
    const { rows } = await query(config.sql);
    const body = rows.map((row) => Object.values(row).map((value) =>
      (value instanceof Date ? value.toISOString() : value ?? '')));
    const buffer = format === 'csv'
      ? this.#writer.csv(config.headers, body)
      : await this.#writer.xlsx(config.headers, body, target);
    return {
      buffer,
      filename: `${target}-${new Date().toISOString().slice(0, 10)}.${format}`,
      contentType: format === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
