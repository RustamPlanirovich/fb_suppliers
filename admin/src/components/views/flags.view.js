import { api } from '../../utils/api.js';
import { EVENTS, FLAG_TYPE_LABELS } from '../../utils/constants.js';
import { dateTime } from '../../utils/format.js';
import { el } from '../../utils/dom.js';
import { Table } from '../table/table.js';
import { View } from './view.base.js';

const SEVERITY_BADGE = { critical: 'danger', warning: 'warning', info: '' };

// Очередь «что разгрести»: устаревшие цены, давние проверки, жалобы, аномалии.
export class FlagsView extends View {
  #table;
  #summary;
  #query = {};

  async mount() {
    this.#table = new Table({
      columns: this.#columns(),
      selectable: true,
      bulkActions: [
        { id: 'resolved', title: 'Отметить решённым' },
        { id: 'ignored', title: 'Игнорировать' },
      ],
    }).init();

    const summaryCard = this.card('Сводка по флагам');
    this.#summary = el('div', 'card__grid');
    summaryCard.querySelector('.card__body').append(this.#summary);

    const listCard = this.card('Открытые флаги', [
      { title: 'Просканировать', variant: 'button_primary', onClick: () => this.#scan() },
    ]);
    listCard.querySelector('.card__body').append(this.#table.element);
    this.root.replaceChildren(summaryCard, listCard);

    this.#table.element.addEventListener(EVENTS.TABLE_PAGE, (event) => {
      this.#query.page = event.detail.page;
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_ACTION, (event) =>
      this.#resolve(event.detail));
    await this.#load();
  }

  #columns() {
    return [
      { title: 'Тип', render: (row) => FLAG_TYPE_LABELS[row.type] ?? row.type },
      {
        title: 'Важность',
        render: (row) => this.badge(row.severity, SEVERITY_BADGE[row.severity]),
      },
      { title: 'Сущность', render: (row) => `${row.entity} #${row.entity_id}` },
      { title: 'Детали', render: (row) => JSON.stringify(row.details) },
      { title: 'Создан', render: (row) => dateTime(row.created_at) },
    ];
  }

  async #load() {
    const [summary, list] = await Promise.all([
      this.guard(() => api.get('/flags/summary')),
      this.guard(() => api.get('/flags', this.#query)),
    ]);
    if (summary) {
      this.#summary.replaceChildren(...(summary.length
        ? summary.map((row) => this.stat(FLAG_TYPE_LABELS[row.type] ?? row.type, row.count, row.severity,
          row.severity === 'critical' ? 'danger' : ''))
        : [el('p', 'empty', 'Открытых флагов нет')]));
    }
    if (list) this.#table.render(list);
  }

  async #scan() {
    const result = await this.guard(() => api.post('/flags/scan', {}));
    if (result) {
      this.toast.success(`Проверено записей: ${result.raised}`);
      await this.#load();
    }
  }

  async #resolve({ action, ids }) {
    const result = await this.guard(() =>
      api.post('/flags/resolve', { ids: ids.map(Number), status: action }));
    if (result) {
      this.toast.success(`Закрыто флагов: ${result.affected}`);
      await this.#load();
    }
  }
}
