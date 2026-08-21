import { api } from '../../utils/api.js';
import { EVENTS, SUPPLIER_STATUS_LABELS, SUPPLIER_SOURCE_LABELS } from '../../utils/constants.js';
import { date, label, num } from '../../utils/format.js';
import { Table } from '../table/table.js';
import { Filters } from '../filters/filters.js';
import { View } from './view.base.js';
import { SupplierEditor } from './suppliers/supplier.editor.js';
import { DuplicatesPanel } from './suppliers/duplicates.panel.js';

const STATUS_BADGE = {
  verified: 'success', pending: 'warning', recheck: 'warning',
  blocked: 'danger', archived: '', draft: '',
};

// Реестр поставщиков: фильтры, массовые действия, карточка с историей изменений.
export class SuppliersView extends View {
  #table;
  #filters;
  #query = {};
  #editor;
  #duplicates;

  constructor(deps) {
    super(deps);
    this.#editor = new SupplierEditor(this);
    this.#duplicates = new DuplicatesPanel(this);
  }

  async mount() {
    // Запрос из строки поиска в шапке приходит параметром маршрута.
    if (this.params.q) this.#query = { q: this.params.q };
    this.#filters = new Filters(this.#filterFields()).init();
    this.#table = new Table({
      columns: this.#columns(),
      selectable: true,
      bulkActions: [
        { id: 'verified', title: 'Проверен' },
        { id: 'recheck', title: 'На перепроверку' },
        { id: 'hide', title: 'Скрыть' },
        { id: 'show', title: 'Показать' },
        { id: 'delete', title: 'Удалить' },
      ],
      onRowClick: (id) => this.#editor.open(Number(id)),
    }).init();

    const card = this.card('Поставщики', [
      { title: 'Добавить', variant: 'button_primary', onClick: () => this.#editor.create() },
      { title: 'Поиск дублей', onClick: () => this.#duplicates.open() },
    ]);
    card.querySelector('.card__body').append(this.#filters.element, this.#table.element);
    this.root.replaceChildren(card);

    this.#filters.element.addEventListener(EVENTS.FILTERS_CHANGE, (event) => {
      this.#query = { ...event.detail.values, page: 1 };
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_PAGE, (event) => {
      this.#query.page = event.detail.page;
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_ACTION, (event) => this.#bulk(event.detail));
    await this.#load();
  }

  async reload() {
    await this.#load();
  }

  #filterFields() {
    return [
      { name: 'q', label: 'Поиск', placeholder: 'Название, контакт, товар' },
      {
        name: 'status',
        label: 'Статус',
        type: 'select',
        options: Object.entries(SUPPLIER_STATUS_LABELS).map(([value, text]) => ({ value, label: text })),
      },
      {
        name: 'source',
        label: 'Источник',
        type: 'select',
        options: Object.entries(SUPPLIER_SOURCE_LABELS).map(([value, text]) => ({ value, label: text })),
      },
      { name: 'staleCheckDays', label: 'Не проверялся, дней', type: 'number', placeholder: '30' },
      {
        name: 'sort',
        label: 'Сортировка',
        type: 'select',
        placeholder: 'По дате',
        options: [
          { value: 'reliability', label: 'По надёжности' },
          { value: 'deals', label: 'По сделкам' },
          { value: 'complaints', label: 'По жалобам' },
          { value: 'checked', label: 'По давности проверки' },
        ],
      },
    ];
  }

  #columns() {
    return [
      { title: 'Название', key: 'name' },
      { title: 'Источник', render: (row) => label(SUPPLIER_SOURCE_LABELS, row.source) },
      {
        title: 'Статус',
        render: (row) => this.badge(label(SUPPLIER_STATUS_LABELS, row.status), STATUS_BADGE[row.status]),
      },
      { title: 'Надёжность', render: (row) => num(row.score_reliability) },
      { title: 'Сделки 30д', render: (row) => num(row.confirmed_deals_30d) },
      { title: 'Жалобы', render: (row) => num(row.complaints_count) },
      { title: 'Предложений', render: (row) => num(row.offers_count) },
      { title: 'Проверен', render: (row) => date(row.checked_at) },
      { title: '', render: () => this.rowButton('Открыть', 'open') },
    ];
  }

  async #load() {
    const data = await this.guard(() => api.get('/suppliers', this.#query));
    if (data) this.#table.render(data);
  }

  async #bulk({ action, ids }) {
    if (action === 'open') return this.#editor.open(Number(ids[0]));
    const map = {
      verified: { action: 'status', value: 'verified' },
      recheck: { action: 'status', value: 'recheck' },
      hide: { action: 'hide' },
      show: { action: 'show' },
      delete: { action: 'delete' },
    };
    const payload = map[action];
    if (!payload) return null;
    if (payload.action === 'delete'
      && !confirm(`Удалить ${ids.length} записей? Действие необратимо.`)) return null;
    const result = await this.guard(() =>
      api.post('/suppliers/bulk', { ids: ids.map(Number), ...payload }));
    if (result) this.toast.success(`Изменено записей: ${result.affected}`);
    return this.#load();
  }
}
