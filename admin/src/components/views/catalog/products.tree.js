import { api } from '../../../utils/api.js';
import { el } from '../../../utils/dom.js';
import { ago, money, num, pct } from '../../../utils/format.js';
import { LEVEL_LABELS } from '../../../utils/constants.js';

const COLUMNS = [
  { title: 'Товар' },
  { title: 'Вариантов' },
  { title: 'Предложений' },
  { title: 'Поставщиков' },
  { title: 'Закупка от' },
  { title: 'Медиана' },
  { title: 'Продажа' },
  { title: 'Лучшая маржа' },
  { title: 'Конкуренция' },
  { title: 'Спрос' },
  { title: '' },
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
      el('td', 'table__td', money(product.buy_median)),
      el('td', 'table__td', money(product.sell_avg)),
      el('td', 'table__td', pct(product.margin_max)),
      el('td', 'table__td', LEVEL_LABELS[product.competition_best] ?? '—'),
      el('td', 'table__td', num(product.demand)),
      this.#aliasesCell(product),
    );
    return row;
  }

  // Синонимы редактируются прямо из списка: чаще всего их правят, увидев пустой запрос.
  #aliasesCell(product) {
    const cell = el('td', 'table__td');
    const button = el('button', 'button button_small', 'Синонимы');
    button.type = 'button';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#view.editAliases(product);
    });
    cell.append(button);
    return cell;
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

    // Вариант тоже раскрывается — до конкретных предложений, из которых сложилась цена.
    const toggle = el('button', 'table__toggle');
    toggle.type = 'button';
    toggle.append(el('span', 'table__chevron', '›'), el('span', null, variant.name));
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#toggleOffers(variant, row, toggle);
    });
    const first = el('td', 'table__td');
    first.append(toggle);

    const edit = el('button', 'button button_small', 'Изменить');
    edit.type = 'button';
    edit.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#view.editVariant(Number(variant.id));
    });
    const last = el('td', 'table__td');
    last.append(edit);

    row.append(
      first,
      el('td', 'table__td', '—'),
      el('td', 'table__td', num(variant.offers_count)),
      el('td', 'table__td', num(variant.suppliers_count)),
      el('td', 'table__td', money(variant.buy_min)),
      el('td', 'table__td', money(variant.buy_median)),
      el('td', 'table__td', money(variant.sell_avg)),
      el('td', 'table__td', pct(variant.margin_pct)),
      el('td', 'table__td', LEVEL_LABELS[variant.competition] ?? '—'),
      el('td', 'table__td', num(variant.demand_score)),
      last,
    );
    return row;
  }

  // Предложения варианта: у кого именно эта цена и где посмотреть товар.
  async #toggleOffers(variant, row, toggle) {
    const key = `offers-${variant.id}`;
    if (this.#open.has(key)) {
      this.#open.delete(key);
      toggle.classList.remove('table__toggle_open');
      this.#removeChildren(key);
      return;
    }
    if (!this.#variants.has(key)) {
      const data = await this.#view.guard(() =>
        api.get('/offers', { variantId: variant.id, limit: 25, sort: 'price', isActive: true }));
      if (!data) return;
      this.#variants.set(key, data.items);
    }
    this.#open.add(key);
    toggle.classList.add('table__toggle_open');
    const offers = this.#variants.get(key);
    row.after(...(offers.length
      ? offers.map((offer) => this.#offerRow(key, offer))
      : [this.#noteRow(key, 'Активных предложений нет')]));
  }

  #offerRow(key, offer) {
    const row = el('tr', 'table__row table__row_child');
    row.dataset.child = key;
    const text = `${offer.supplier_name} · ${offer.title ?? ''}`.trim();
    const title = el('td', 'table__td table__td_wide', text);
    title.title = text;

    const link = el('td', 'table__td');
    if (offer.url) {
      const open = el('a', 'button button_small', 'Открыть товар');
      open.href = offer.url;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      link.append(open);
    }
    row.append(
      title,
      el('td', 'table__td', offer.supplier_source),
      el('td', 'table__td', '—'),
      el('td', 'table__td', '—'),
      el('td', 'table__td', money(offer.price)),
      el('td', 'table__td', '—'),
      el('td', 'table__td', '—'),
      el('td', 'table__td', '—'),
      el('td', 'table__td', `цена ${ago(offer.price_checked_at)} назад`),
      el('td', 'table__td', num(offer.score_reliability)),
      link,
    );
    return row;
  }

  #noteRow(key, text) {
    const row = el('tr', 'table__row table__row_child');
    row.dataset.child = key;
    const cell = el('td', 'table__td empty', text);
    cell.colSpan = COLUMNS.length;
    row.append(cell);
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
