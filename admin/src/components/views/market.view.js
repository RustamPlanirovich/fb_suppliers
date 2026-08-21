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
      this.#emptyQueries(data.empty_queries),
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

  // Пустой запрос — это либо нехватка товара, либо непривязанный синоним.
  // Из этого экрана синоним добавляется в один клик.
  #emptyQueries(rows) {
    const card = this.card('Ищут, но у нас нет');
    const body = card.querySelector('.card__body');
    body.replaceChildren(...(rows?.length
      ? rows.map((row) => this.#emptyQueryRow(row))
      : [el('p', 'empty', 'Все запросы что-то находят')]));
    return card;
  }

  #emptyQueryRow(row) {
    const box = el('div', 'card__header');
    box.append(el('p', 'field__error', `${row.query_norm} — ${row.count} поисков`));
    const button = el('button', 'button button_small', 'Привязать к товару');
    button.type = 'button';
    button.addEventListener('click', () => this.#bind(row.query_norm));
    box.append(button);
    return box;
  }

  async #bind(queryText) {
    const products = await this.guard(() => api.get('/catalog/products', { limit: 200 }));
    if (!products) return;
    const data = await this.modal.open({
      title: `«${queryText}» — какой это товар?`,
      submitText: 'Привязать',
      fields: [{
        name: 'productId',
        label: 'Товар',
        type: 'select',
        options: products.items.map((item) => ({ value: item.id, label: item.name })),
        hint: 'Запрос станет синонимом: дальше бот будет находить товар по нему',
      }],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.post(`/catalog/products/${data.productId}/aliases`,
        { alias: queryText, source: 'query' });
      this.toast.success('Синоним добавлен — запрос больше не будет пустым');
    });
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
