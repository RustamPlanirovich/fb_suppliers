import { api } from '../../utils/api.js';
import { el } from '../../utils/dom.js';
import { EVENTS } from '../../utils/constants.js';
import { normalizePagingLabel } from './catalog/paging.label.js';
import { Filters } from '../filters/filters.js';
import { View } from './view.base.js';
import { ProductsTree } from './catalog/products.tree.js';
import { VariantEditor } from './catalog/variant.editor.js';

// Каталог: товары свёрнутыми группами, варианты раскрываются по клику.
export class CatalogView extends View {
  #tree;
  #editor;
  #query = { sort: 'margin' };
  #pager;

  constructor(deps) {
    super(deps);
    this.#tree = new ProductsTree(this);
    this.#editor = new VariantEditor(this);
  }

  async mount() {
    const filters = new Filters(this.#filterFields()).init();
    this.#tree.init();
    this.#pager = el('div', 'pager');

    const card = this.card('Товары', [
      { title: 'Новый товар', variant: 'button_primary', onClick: () => this.#editor.createProduct() },
      { title: 'Новый вариант', onClick: () => this.#editor.createVariant() },
      { title: 'Пересчитать статистику', onClick: () => this.#refreshStats() },
    ]);
    card.querySelector('.card__body').append(filters.element, this.#tree.element, this.#pager);
    this.root.replaceChildren(card);

    filters.element.addEventListener(EVENTS.FILTERS_CHANGE, (event) => {
      this.#query = { ...event.detail.values, page: 1 };
      this.#load();
    });
    await this.#load();
  }

  #filterFields() {
    return [
      { name: 'q', label: 'Поиск', placeholder: 'Название товара' },
      { name: 'marginMin', label: 'Лучшая маржа от, %', type: 'number' },
      { name: 'priceMax', label: 'Закупка до, ₽', type: 'number' },
      {
        name: 'sort',
        label: 'Сортировка',
        type: 'select',
        placeholder: 'По названию',
        value: 'margin',
        options: [
          { value: 'margin', label: 'По марже' },
          { value: 'offers', label: 'По числу предложений' },
          { value: 'suppliers', label: 'По числу поставщиков' },
          { value: 'price', label: 'По цене закупки' },
          { value: 'demand', label: 'По спросу' },
          { value: 'variants', label: 'По числу вариантов' },
        ],
      },
      {
        name: 'hasOffers',
        label: 'Показывать',
        type: 'select',
        placeholder: 'Все товары',
        options: [{ value: 'true', label: 'Только с предложениями' }],
      },
    ];
  }

  async #load() {
    const data = await this.guard(() => api.get('/catalog/products', this.#query));
    if (!data) return;
    this.#tree.render(data.items);
    this.#renderPager(data);
  }

  #renderPager(data) {
    const prev = el('button', 'button button_small', 'Назад');
    prev.type = 'button';
    prev.disabled = data.page <= 1;
    prev.addEventListener('click', () => this.#goto(data.page - 1));
    const next = el('button', 'button button_small', 'Вперёд');
    next.type = 'button';
    next.disabled = data.page >= data.pages;
    next.addEventListener('click', () => this.#goto(data.page + 1));
    this.#pager.replaceChildren(prev, el('span', 'pager__info', normalizePagingLabel(data)), next);
  }

  #goto(page) {
    this.#query.page = page;
    this.#load();
  }

  // Вызывается деревом при клике по строке варианта.
  editVariant(id) {
    return this.#editor.editVariant(id);
  }

  async reload() {
    await this.#load();
  }

  async #refreshStats() {
    const result = await this.guard(() => api.post('/catalog/variants/refresh-stale', {}));
    if (result) {
      this.toast.success(`Пересчитано вариантов: ${result.refreshed}`);
      await this.#load();
    }
  }
}
