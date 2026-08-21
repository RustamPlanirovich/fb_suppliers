import { TableWriter } from '../io/table.writer.js';
import { BOT_LIMITS } from '../../utils/constants.js';

const HEADERS = ['Поставщик', 'Источник', 'Рейтинг площадки', 'Сделок за 30 дней',
  'Товар', 'Вариант', 'Название лота', 'Цена', 'Валюта', 'Ссылка'];

// Выгрузка показанного в боте списка: те же строки, но разложенные по колонкам.
export class BotExporter {
  #categories;
  #writer = new TableWriter();

  constructor(categories) {
    this.#categories = categories;
  }

  async build(kind, id) {
    const rows = await this.#rows(kind, id);
    if (!rows.length) return null;
    const body = rows.map((row) => [
      row.supplier, row.source, row.source_rating ?? '', row.confirmed_deals_30d ?? '',
      row.product, row.variant, row.title ?? '', row.price ?? '', row.currency, row.url ?? '',
    ]);
    return {
      buffer: this.#writer.csv(HEADERS, body),
      filename: `postavshiki-${kind}-${id}.csv`,
      rows: rows.length,
    };
  }

  #rows(kind, id) {
    if (kind === 'variant') return this.#categories.exportByVariant(id, BOT_LIMITS.EXPORT_LIMIT);
    if (kind === 'category') return this.#categories.exportByCategory(id, BOT_LIMITS.EXPORT_LIMIT);
    return Promise.resolve([]);
  }
}
