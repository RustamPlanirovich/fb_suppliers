import { api } from '../../../utils/api.js';
import { el } from '../../../utils/dom.js';
import { money, num, pct } from '../../../utils/format.js';
import { LEVEL_LABELS } from '../../../utils/constants.js';

const COLUMNS = [
  { title: 'Товар' },
  { title: 'Вариантов' },
  { title: 'Предложений' },
  { title: 'Поставщиков' },
  { title: 'Закупка от' },
  { title: 'Продажа' },
  { title: 'Лучшая маржа' },
  { title: 'Конкуренция' },
  { title: 'Спрос' },
];

// Список товаров: каждая строка — свёрнутая группа вариантов, раскрывается по клику.
export class ProductsTree {
  #view;
  #root = el('div', 'table');
  #body = el('tbody', 'table__body');
  #open = new Set();
  #variants = new Map();

  constructor(view) {
    this.#view = view;
  }

  get element() {
    return this.#root;
  }

  init() {
    const scroll = el('div', 'table__scroll');
    const table = el('table', 'table__grid');
    const head = el('thead', 'table__head');
    const headRow = el('tr');
    headRow.append(...COLUMNS.map((column) => el('th', 'table__th', column.title)));
    head.append(headRow);
    table.append(head, this.#body);
    scroll.append(table);
    this.#root.replaceChildren(scroll);
    return this;
  }

  render(products) {
    this.#open.clear();
    this.#variants.clear();
    this.#body.replaceChildren(...(products.length
      ? products.map((product) => this.#productRow(product))
      : [this.#emptyRow()]));
  }

  #productRow(product) {
    const row = el('tr', 'table__row');
    row.dataset.product = product.id;

    const toggle = el('button', 'table__toggle');
    toggle.type = 'button';
    toggle.append(el('span', 'table__chevron', '›'), el('span', null, product.name));
    toggle.addEventListener('click', () => this.#toggle(product, row, toggle));

    const first = el('td', 'table__td');
    first.append(toggle);
    row.append(
      first,
      el('td', 'table__td', num(product.variants_count)),
      el('td', 'table__td', num(product.offers_count)),
      el('td', 'table__td', num(product.suppliers_count)),
      el('td', 'table__td', money(product.buy_min)),
      el('td', 'table__td', money(product.sell_avg)),
      el('td', 'table__td', pct(product.margin_max)),
      el('td', 'table__td', LEVEL_LABELS[product.competition_best] ?? '—'),
      el('td', 'table__td', num(product.demand)),
    );
    return row;
  }

  // Варианты подгружаются при первом раскрытии и дальше берутся из памяти.
  async #toggle(product, row, toggle) {
    const id = String(product.id);
    if (this.#open.has(id)) {
      this.#open.delete(id);
      toggle.classList.remove('table__toggle_open');
      this.#removeChildren(id);
      return;
    }
    if (!this.#variants.has(id)) {
      const data = await this.#view.guard(() =>
        api.get('/catalog/variants', { productId: product.id, limit: 200, sort: 'margin' }));
      if (!data) return;
      this.#variants.set(id, data.items);
    }
    this.#open.add(id);
    toggle.classList.add('table__toggle_open');
    const rows = this.#variants.get(id).map((variant) => this.#variantRow(id, variant));
    row.after(...rows);
  }

  #variantRow(productId, variant) {
    const row = el('tr', 'table__row table__row_child');
    row.dataset.child = productId;
    row.append(
      el('td', 'table__td', variant.name),
      el('td', 'table__td', '—'),
      el('td', 'table__td', num(variant.offers_count)),
      el('td', 'table__td', num(variant.suppliers_count)),
      el('td', 'table__td', money(variant.buy_min)),
      el('td', 'table__td', money(variant.sell_avg)),
      el('td', 'table__td', pct(variant.margin_pct)),
      el('td', 'table__td', LEVEL_LABELS[variant.competition] ?? '—'),
      el('td', 'table__td', num(variant.demand_score)),
    );
    row.addEventListener('click', () => this.#view.editVariant(Number(variant.id)));
    return row;
  }

  #removeChildren(productId) {
    for (const row of this.#body.querySelectorAll(`[data-child="${productId}"]`)) row.remove();
  }

  #emptyRow() {
    const row = el('tr');
    const cell = el('td', 'table__td empty', 'Товаров пока нет');
    cell.colSpan = COLUMNS.length;
    row.append(cell);
    return row;
  }
}
