import { api } from '../../../utils/api.js';
import { el } from '../../../utils/dom.js';
import { money, num, pct } from '../../../utils/format.js';
import { EVENTS, LEVEL_LABELS } from '../../../utils/constants.js';
import { Filters } from '../../filters/filters.js';
import { Table } from '../../table/table.js';

// Готовые вопросы администратора: каждый — набор условий на бэкенде.
const PRESETS = [
  { id: 'sell', title: 'Выгодно продавать', hint: 'высокая маржа и мало конкурентов' },
  { id: 'buy', title: 'Выгодно покупать', hint: 'маржа есть, цена закупки снижается' },
  { id: 'rising', title: 'Растёт спрос', hint: 'позиции, которые чаще смотрят' },
  { id: 'falling', title: 'Цена падает', hint: 'закупка подешевела за неделю' },
];

// «Что выгодно»: витрина с пресетами, фильтрами и сортировкой.
export class OpportunitiesPanel {
  #view;
  #table;
  #filters;
  #tabs = el('div', 'tabs');
  #preset = 'sell';
  #query = {};

  constructor(view) {
    this.#view = view;
  }

  render() {
    const card = this.#view.card('Что выгодно прямо сейчас', [
      {
        title: 'Выгрузить XLSX',
        onClick: () => window.open(api.downloadUrl('/io/exports/arbitrage', { format: 'xlsx' }), '_blank'),
      },
    ]);
    this.#filters = new Filters(this.#fields()).init();
    this.#table = new Table({ columns: this.#columns() }).init();
    this.#renderTabs();

    card.querySelector('.card__body').append(this.#tabs, this.#filters.element, this.#table.element);
    this.#filters.element.addEventListener(EVENTS.FILTERS_CHANGE, (event) => {
      this.#query = { ...event.detail.values, page: 1 };
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_PAGE, (event) => {
      this.#query.page = event.detail.page;
      this.#load();
    });
    this.#load();
    return card;
  }

  #renderTabs() {
    this.#tabs.replaceChildren(...PRESETS.map((preset) => {
      const button = el('button', 'tabs__item', preset.title);
      button.type = 'button';
      button.title = preset.hint;
      if (preset.id === this.#preset) button.classList.add('tabs__item_active');
      button.addEventListener('click', () => {
        this.#preset = preset.id;
        this.#query = {};
        this.#renderTabs();
        this.#load();
      });
      return button;
    }));
  }

  #fields() {
    return [
      { name: 'q', label: 'Поиск', placeholder: 'Товар или вариант' },
      { name: 'marginMin', label: 'Маржа от, %', type: 'number' },
      { name: 'profitMin', label: 'Прибыль от, ₽', type: 'number' },
      { name: 'priceMax', label: 'Закупка до, ₽', type: 'number' },
      {
        name: 'competition',
        label: 'Конкуренция',
        type: 'select',
        options: Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label })),
      },
      { name: 'sellersMax', label: 'Продавцов не больше', type: 'number' },
      { name: 'suppliersMin', label: 'Поставщиков от', type: 'number' },
      { name: 'trendMax', label: 'Тренд цены не выше, %', type: 'number', placeholder: '-5' },
      {
        name: 'sort',
        label: 'Сортировка',
        type: 'select',
        placeholder: 'По марже',
        options: [
          { value: 'profit', label: 'По прибыли' },
          { value: 'competition', label: 'По конкуренции (меньше сначала)' },
          { value: 'demand', label: 'По спросу' },
          { value: 'trend_down', label: 'По падению цены' },
          { value: 'trend_up', label: 'По росту цены' },
          { value: 'suppliers', label: 'По числу поставщиков' },
          { value: 'price', label: 'По цене закупки' },
        ],
      },
    ];
  }

  #columns() {
    return [
      { title: 'Товар', key: 'product_name' },
      { title: 'Вариант', key: 'variant_name' },
      { title: 'Закупка от', render: (row) => money(row.buy_min) },
      { title: 'Продажа', render: (row) => money(row.sell_avg) },
      { title: 'Чистыми', render: (row) => money(row.profit) },
      { title: 'Маржа', render: (row) => pct(row.margin_pct) },
      {
        title: 'Конкуренция',
        render: (row) => this.#view.badge(LEVEL_LABELS[row.competition] ?? '—',
          row.competition === 'low' ? 'success' : ''),
      },
      { title: 'Продавцов', render: (row) => num(row.sellers_count) },
      { title: 'Поставщиков', render: (row) => num(row.suppliers_count) },
      { title: 'Тренд 7д', render: (row) => pct(row.trend_7d_pct) },
      { title: 'Спрос', render: (row) => num(row.demand_score) },
    ];
  }

  async #load() {
    const data = await this.#view.guard(() =>
      api.get('/analytics/opportunities', { preset: this.#preset, ...this.#query }));
    if (data) this.#table.render(data);
  }
}
