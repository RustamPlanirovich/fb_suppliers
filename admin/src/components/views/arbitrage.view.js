import { api } from '../../utils/api.js';
import { ARBITRAGE_MARK_LABELS, EVENTS, LEVEL_LABELS, RISK_LABELS } from '../../utils/constants.js';
import { money, pct } from '../../utils/format.js';
import { Table } from '../table/table.js';
import { Filters } from '../filters/filters.js';
import { View } from './view.base.js';

const RISK_BADGE = { low: 'success', medium: 'warning', high: 'danger' };

// Связки «купить → продать»: прибыль, ROI, риск. Админ помечает качество связки.
export class ArbitrageView extends View {
  #table;
  #query = { sort: 'roi' };

  async mount() {
    const filters = new Filters([
      { name: 'roiMin', label: 'ROI от, %', type: 'number', placeholder: '20' },
      { name: 'profitMin', label: 'Прибыль от, ₽', type: 'number' },
      { name: 'buyMax', label: 'Закупка до, ₽', type: 'number' },
      {
        name: 'riskLevel',
        label: 'Риск',
        type: 'select',
        options: Object.entries(RISK_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        name: 'competition',
        label: 'Конкуренция',
        type: 'select',
        options: Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        name: 'adminMark',
        label: 'Пометка',
        type: 'select',
        options: Object.entries(ARBITRAGE_MARK_LABELS).map(([value, label]) => ({ value, label })),
      },
    ]).init();

    this.#table = new Table({ columns: this.#columns() }).init();

    const card = this.card('Сканер связок', [
      { title: 'Пересчитать', variant: 'button_primary', onClick: () => this.#recompute() },
      {
        title: 'Выгрузить XLSX',
        onClick: () => window.open(api.downloadUrl('/io/exports/arbitrage', { format: 'xlsx' }), '_blank'),
      },
    ]);
    card.querySelector('.card__body').append(filters.element, this.#table.element);
    this.root.replaceChildren(card);

    filters.element.addEventListener(EVENTS.FILTERS_CHANGE, (event) => {
      this.#query = { sort: 'roi', ...event.detail.values, page: 1 };
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_PAGE, (event) => {
      this.#query.page = event.detail.page;
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_ACTION, (event) =>
      this.#mark(Number(event.detail.ids[0])));
    await this.#load();
  }

  #columns() {
    return [
      { title: 'Товар', key: 'product_name' },
      { title: 'Вариант', key: 'variant_name' },
      { title: 'Поставщик', key: 'supplier_name' },
      { title: 'Площадка', key: 'marketplace_name' },
      { title: 'Купить', render: (row) => money(row.buy_price) },
      { title: 'Продать', render: (row) => money(row.sell_price) },
      { title: 'Чистыми', render: (row) => money(row.profit) },
      { title: 'ROI', render: (row) => pct(row.roi_pct) },
      { title: 'Риск', render: (row) => this.badge(RISK_LABELS[row.risk_level] ?? '—', RISK_BADGE[row.risk_level]) },
      { title: 'Конкуренция', render: (row) => LEVEL_LABELS[row.competition] ?? '—' },
      { title: 'Цена, ч', key: 'price_age_hours' },
      { title: 'Пометка', render: (row) => ARBITRAGE_MARK_LABELS[row.admin_mark] },
      { title: '', render: () => this.rowButton('Пометить', 'mark') },
    ];
  }

  async #load() {
    const data = await this.guard(() => api.get('/arbitrage', this.#query));
    if (data) this.#table.render(data);
  }

  async #recompute() {
    const result = await this.guard(() => api.post('/arbitrage/recompute', {}));
    if (result) {
      this.toast.success(`Пересчитано связок: ${result.computed}`);
      await this.#load();
    }
  }

  async #mark(id) {
    const data = await this.modal.open({
      title: 'Пометка связки',
      fields: [
        {
          name: 'mark',
          label: 'Оценка',
          type: 'select',
          options: Object.entries(ARBITRAGE_MARK_LABELS).map(([value, label]) => ({ value, label })),
        },
        { name: 'note', label: 'Комментарий', type: 'textarea' },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.post(`/arbitrage/${id}/mark`, { mark: data.mark, note: data.note || undefined });
      this.toast.success('Пометка сохранена');
      await this.#load();
    });
  }
}
