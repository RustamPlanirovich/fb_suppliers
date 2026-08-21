import { api } from '../../utils/api.js';
import {
  COMPLAINT_REASON_LABELS, EVENTS, QUEUE_LABELS, SUBMISSION_TYPE_LABELS,
} from '../../utils/constants.js';
import { dateTime } from '../../utils/format.js';
import { el } from '../../utils/dom.js';
import { Table } from '../table/table.js';
import { View } from './view.base.js';
import { QUEUE_COLUMNS, QUEUE_STATUSES } from './moderation/queue.config.js';

// Очереди модерации: жалобы, отзывы, правки пользователей, подтверждения сделок.
export class ModerationView extends View {
  #table;
  #queue = 'complaints';
  #query = {};
  #tabs;
  #counts = {};

  async mount() {
    this.#tabs = el('div', 'tabs');
    const card = this.card('Модерация');
    card.querySelector('.card__body').append(this.#tabs);
    this.root.replaceChildren(card);

    this.#counts = await this.guard(() => api.get('/moderation/counts')) ?? {};
    this.#renderTabs();
    await this.#openQueue(this.#queue);
  }

  #renderTabs() {
    this.#tabs.replaceChildren(...Object.entries(QUEUE_LABELS).map(([id, title]) => {
      const button = el('button', 'tabs__item', `${title} (${this.#counts[id] ?? 0})`);
      button.type = 'button';
      if (id === this.#queue) button.classList.add('tabs__item_active');
      button.addEventListener('click', () => this.#openQueue(id));
      return button;
    }));
  }

  // Переключение очереди: таблица пересобирается под её колонки.
  async #openQueue(queue) {
    this.#queue = queue;
    this.#query = {};
    this.#renderTabs();
    this.#table = new Table({
      columns: this.#columns(),
      onRowClick: (id) => this.#resolve(Number(id)),
    }).init();
    this.#table.element.addEventListener(EVENTS.TABLE_PAGE, (event) => {
      this.#query.page = event.detail.page;
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_ACTION, (event) =>
      this.#resolve(Number(event.detail.ids[0])));
    this.root.querySelector('.card__body').replaceChildren(this.#tabs, this.#table.element);
    await this.#load();
  }

  #columns() {
    const base = QUEUE_COLUMNS[this.#queue].map((column) => ({
      title: column.title,
      render: (row) => this.#cell(column, row),
    }));
    return [...base, { title: '', render: () => this.rowButton('Решить', 'resolve') }];
  }

  #cell(column, row) {
    if (column.key === 'created_at') return dateTime(row.created_at);
    if (column.key === 'reason') return COMPLAINT_REASON_LABELS[row.reason] ?? row.reason;
    if (column.key === 'type') return SUBMISSION_TYPE_LABELS[row.type] ?? row.type;
    if (column.key === 'payload') return JSON.stringify(row.payload ?? {});
    if (column.key === 'user') return row.username ? `@${row.username}` : String(row.telegram_id ?? '—');
    return row[column.key];
  }

  async #load() {
    const data = await this.guard(() => api.get(`/moderation/${this.#queue}`, this.#query));
    if (data) this.#table.render(data);
  }

  async #resolve(id) {
    const data = await this.modal.open({
      title: 'Решение по обращению',
      fields: [
        {
          name: 'status',
          label: 'Статус',
          type: 'select',
          options: QUEUE_STATUSES[this.#queue].map((value) => ({ value, label: value })),
        },
        { name: 'resolution', label: 'Комментарий администратора', type: 'textarea' },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      const result = await api.post(`/moderation/${this.#queue}/${id}/resolve`, {
        status: data.status,
        resolution: data.resolution || undefined,
      });
      this.toast.success(result.applied?.applied ? 'Решено и применено к базе' : 'Решение сохранено');
      await this.#load();
    });
  }
}
