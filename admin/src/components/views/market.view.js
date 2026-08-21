import { api } from '../../utils/api.js';
import { el } from '../../utils/dom.js';
import { money, num, pct } from '../../utils/format.js';
import { LEVEL_LABELS } from '../../utils/constants.js';
import { View } from './view.base.js';
import { OpportunitiesPanel } from './market/opportunities.panel.js';

// «Что сейчас происходит на рынке»: спрос, дефицит в базе, маржа, проблемные поставщики.
export class MarketView extends View {
  #opportunities;

  constructor(deps) {
    super(deps);
    this.#opportunities = new OpportunitiesPanel(this);
  }

  async mount() {
    const data = await this.guard(() => api.get('/analytics/market', { period: 'month' }));
    if (!data) return;
    this.root.replaceChildren(
      this.#opportunities.render(),
      this.#list('Ищут, но у нас нет', data.empty_queries,
        (row) => `${row.query_norm} — ${row.count} поисков, 0 поставщиков`, 'danger'),
      this.#list('Самые частые запросы', data.top_queries,
        (row) => `${row.query_norm} — ${row.count}`),
      this.#list('Самые просматриваемые позиции', data.top_variants,
        (row) => `${row.product_name} — ${row.variant_name}: ${row.views} просмотров,`
          + ` маржа ${pct(row.margin_pct)}`),
      this.#list('Чаще всего открывают контакты', data.top_suppliers,
        (row) => `${row.name} — ${row.opens} открытий, надёжность ${num(row.score_reliability)}`),
      this.#list('Поставщики с ухудшающимся рейтингом', data.declining_suppliers,
        (row) => `${row.name} — жалоб ${row.complaints_count}, проблемных сделок ${pct(row.problem_rate)}`,
        'danger'),
      this.#list('Что чаще всего сохраняют', data.saved_variants,
        (row) => `${row.product_name} — ${row.variant_name}: ${row.saves}`),
      this.#list('Какие алерты создают', data.alert_types,
        (row) => `${row.type} — ${row.count}`),
    );
  }

  #list(title, rows, format, modifier = '') {
    const card = this.card(title);
    const body = card.querySelector('.card__body');
    body.replaceChildren(...(rows?.length
      ? rows.map((row) => {
        const line = el('p', modifier === 'danger' ? 'field__error' : null, format(row));
        return line;
      })
      : [el('p', 'empty', 'Данных пока нет')]));
    return card;
  }
}
