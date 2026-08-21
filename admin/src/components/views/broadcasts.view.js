import { api } from '../../utils/api.js';
import { EVENTS } from '../../utils/constants.js';
import { dateTime, num } from '../../utils/format.js';
import { Table } from '../table/table.js';
import { View } from './view.base.js';

const STATUS_BADGE = { sent: 'success', sending: 'accent', failed: 'danger', cancelled: '' };

// Рассылки: сегмент → тестовая отправка → запуск с подтверждением охвата.
export class BroadcastsView extends View {
  #table;
  #query = {};

  async mount() {
    this.#table = new Table({ columns: this.#columns() }).init();
    const card = this.card('Рассылки', [
      { title: 'Создать', variant: 'button_primary', onClick: () => this.#create() },
    ]);
    card.querySelector('.card__body').append(this.#table.element);
    this.root.replaceChildren(card);

    this.#table.element.addEventListener(EVENTS.TABLE_PAGE, (event) => {
      this.#query.page = event.detail.page;
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_ACTION, (event) => this.#action(event.detail));
    await this.#load();
  }

  #columns() {
    return [
      { title: 'Заголовок', key: 'title' },
      {
        title: 'Статус',
        render: (row) => this.badge(row.status, STATUS_BADGE[row.status] ?? 'warning'),
      },
      { title: 'Получателей', render: (row) => num(row.total_count) },
      { title: 'Доставлено', render: (row) => num(row.sent_count) },
      { title: 'Ошибок', render: (row) => num(row.failed_count) },
      { title: 'Запланирована', render: (row) => dateTime(row.scheduled_at) },
      {
        title: '',
        render: () => this.buttons(
          this.rowButton('Тест', 'test'),
          this.rowButton('Запустить', 'start'),
          this.rowButton('Отменить', 'cancel', 'button_small button_danger'),
        ),
      },
    ];
  }

  async #load() {
    const data = await this.guard(() => api.get('/broadcasts', this.#query));
    if (data) this.#table.render(data);
  }

  async #create() {
    const plans = await this.guard(() => api.get('/subscriptions/plans'));
    const data = await this.modal.open({
      title: 'Новая рассылка',
      fields: [
        { name: 'title', label: 'Заголовок (для админки)', required: true },
        { name: 'body', label: 'Текст сообщения', type: 'textarea', required: true },
        { name: 'mediaUrl', label: 'Картинка (ссылка)' },
        {
          name: 'planCode',
          label: 'Сегмент: тариф',
          type: 'select',
          options: [{ value: '', label: 'Все пользователи' },
            ...(plans ?? []).map((plan) => ({ value: plan.code, label: plan.name }))],
        },
        { name: 'activeSince', label: 'Сегмент: активны с', type: 'date' },
        { name: 'scheduledAt', label: 'Отправить в', type: 'datetime-local' },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      const segment = {};
      if (data.planCode) segment.planCode = data.planCode;
      if (data.activeSince) segment.activeSince = data.activeSince;
      await api.post('/broadcasts', {
        title: data.title,
        body: data.body,
        mediaUrl: data.mediaUrl || null,
        segment,
        scheduledAt: data.scheduledAt || null,
      });
      this.toast.success('Рассылка создана');
      await this.#load();
    });
  }

  async #action({ action, ids }) {
    const id = Number(ids[0]);
    if (action === 'test') return this.#test(id);
    if (action === 'cancel') return this.#cancel(id);
    if (action === 'start') return this.#start(id);
    return null;
  }

  async #test(id) {
    const data = await this.modal.open({
      title: 'Тестовая отправка',
      fields: [{ name: 'telegramId', label: 'Ваш Telegram ID', type: 'number', required: true }],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.post(`/broadcasts/${id}/test`, { telegramId: Number(data.telegramId) });
      this.toast.success('Тестовое сообщение отправлено');
    });
  }

  // Запуск требует подтверждения точного числа получателей — защита от «отправить всем».
  async #start(id) {
    const estimate = await this.guard(() => api.get(`/broadcasts/${id}/estimate`));
    if (!estimate) return;
    if (!confirm(`Получателей: ${estimate.total}. Запустить рассылку?`)) return;
    await this.guard(async () => {
      await api.post(`/broadcasts/${id}/start`, { confirmedTotal: estimate.total });
      this.toast.success(`Рассылка запущена на ${estimate.total} получателей`);
      await this.#load();
    });
  }

  async #cancel(id) {
    await this.guard(async () => {
      await api.post(`/broadcasts/${id}/cancel`, {});
      this.toast.success('Рассылка отменена');
      await this.#load();
    });
  }
}
