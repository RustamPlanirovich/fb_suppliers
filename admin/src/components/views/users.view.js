import { api } from '../../utils/api.js';
import { EVENTS } from '../../utils/constants.js';
import { date, dateTime, num } from '../../utils/format.js';
import { Table } from '../table/table.js';
import { Filters } from '../filters/filters.js';
import { View } from './view.base.js';

// Пользователи бота: тариф, активность, избранное, блокировка. Только необходимый минимум данных.
export class UsersView extends View {
  #table;
  #query = {};

  async mount() {
    const filters = new Filters([
      { name: 'q', label: 'Поиск', placeholder: 'username или telegram id' },
      {
        name: 'hasSubscription',
        label: 'Подписка',
        type: 'select',
        options: [{ value: 'true', label: 'Есть' }, { value: 'false', label: 'Нет' }],
      },
      { name: 'planCode', label: 'Тариф', placeholder: 'pro' },
      { name: 'activeSince', label: 'Активен с', type: 'date' },
    ]).init();

    this.#table = new Table({
      columns: this.#columns(),
      onRowClick: (id) => this.#open(Number(id)),
    }).init();

    const card = this.card('Пользователи бота');
    card.querySelector('.card__body').append(filters.element, this.#table.element);
    this.root.replaceChildren(card);

    filters.element.addEventListener(EVENTS.FILTERS_CHANGE, (event) => {
      this.#query = { ...event.detail.values, page: 1 };
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_PAGE, (event) => {
      this.#query.page = event.detail.page;
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_ACTION, (event) => {
      const [id] = event.detail.ids;
      if (event.detail.action === 'grant') this.#grant(Number(id));
      if (event.detail.action === 'block') this.#block(Number(id));
    });
    await this.#load();
  }

  #columns() {
    return [
      { title: 'Telegram ID', key: 'telegram_id' },
      { title: 'Username', render: (row) => (row.username ? `@${row.username}` : '—') },
      { title: 'Тариф', render: (row) => row.plan_name ?? 'Free' },
      { title: 'Подписка до', render: (row) => date(row.subscription_ends_at) },
      { title: 'Избранное', render: (row) => num(row.favorites_count) },
      { title: 'Watchlist', render: (row) => num(row.watchlist_count) },
      { title: 'Алертов', render: (row) => num(row.alerts_count) },
      { title: 'Активность', render: (row) => dateTime(row.last_seen_at) },
      {
        title: 'Статус',
        render: (row) => this.badge(row.is_blocked ? 'заблокирован' : 'активен',
          row.is_blocked ? 'danger' : 'success'),
      },
      {
        title: '',
        render: () => this.buttons(
          this.rowButton('Тариф', 'grant'),
          this.rowButton('Блок', 'block', 'button_small button_danger'),
        ),
      },
    ];
  }

  async #load() {
    const data = await this.guard(() => api.get('/users', this.#query));
    if (data) this.#table.render(data);
  }

  async #open(id) {
    const user = await this.guard(() => api.get(`/users/${id}`));
    if (!user) return;
    const favorites = user.favorites.map((row) => `• ${row.name} (${row.status})`).join('\n');
    await this.modal.open({
      title: `Пользователь ${user.telegram_id}`,
      submitText: 'Закрыть',
      fields: [
        { name: '__plan', label: 'Тариф', value: user.plan_name ?? 'Free' },
        { name: '__fav', label: 'Избранное', type: 'textarea', value: favorites || 'Пусто' },
      ],
    });
  }

  async #grant(id) {
    const plans = await this.guard(() => api.get('/subscriptions/plans'));
    if (!plans) return;
    const data = await this.modal.open({
      title: 'Выдать / продлить подписку',
      fields: [
        {
          name: 'planId',
          label: 'Тариф',
          type: 'select',
          options: plans.map((plan) => ({ value: plan.id, label: `${plan.name} (${plan.days} дн)` })),
        },
        { name: 'days', label: 'Дней (пусто — из тарифа)', type: 'number' },
        { name: 'comment', label: 'Комментарий' },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.post('/subscriptions/grant', {
        userId: id,
        planId: Number(data.planId),
        days: data.days ? Number(data.days) : undefined,
        comment: data.comment || undefined,
      });
      this.toast.success('Доступ выдан');
      await this.#load();
    });
  }

  async #block(id) {
    const data = await this.modal.open({
      title: 'Блокировка пользователя',
      fields: [
        { name: 'isBlocked', label: 'Заблокировать', type: 'checkbox', value: true },
        { name: 'note', label: 'Причина' },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.post(`/users/${id}/block`,
        { isBlocked: Boolean(data.isBlocked), note: data.note || undefined });
      this.toast.success('Статус обновлён');
      await this.#load();
    });
  }
}
