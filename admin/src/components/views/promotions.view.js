import { api } from '../../utils/api.js';
import { EVENTS } from '../../utils/constants.js';
import { date, money, pct } from '../../utils/format.js';
import { Table } from '../table/table.js';
import { View } from './view.base.js';

const SLOT_LABELS = { top: 'Топ выдачи', category: 'Топ категории', search: 'Поиск' };

// Платное размещение: прайс слотов и активные закрепления поставщиков.
export class PromotionsView extends View {
  #table;
  #query = {};

  async mount() {
    this.#table = new Table({ columns: this.#columns() }).init();
    const card = this.card('Рекламные размещения', [
      { title: 'Разместить', variant: 'button_primary', onClick: () => this.#create() },
      { title: 'Прайс слотов', onClick: () => this.#editPlacement() },
    ]);
    card.querySelector('.card__body').append(this.#table.element);
    this.root.replaceChildren(card);

    this.#table.element.addEventListener(EVENTS.TABLE_PAGE, (event) => {
      this.#query.page = event.detail.page;
      this.#load();
    });
    this.#table.element.addEventListener(EVENTS.TABLE_ACTION, (event) =>
      this.#stop(Number(event.detail.ids[0])));
    await this.#load();
  }

  #columns() {
    return [
      { title: 'Поставщик', key: 'supplier_name' },
      { title: 'Слот', render: (row) => SLOT_LABELS[row.slot] ?? row.slot },
      { title: 'Категория', render: (row) => row.category_name ?? 'Все' },
      { title: 'Вес', key: 'weight' },
      { title: 'Скидка', render: (row) => pct(row.discount_pct) },
      { title: 'Оплачено', render: (row) => money(row.amount_paid) },
      { title: 'До', render: (row) => date(row.ends_at) },
      {
        title: 'Статус',
        render: (row) => {
          const active = row.is_active && new Date(row.ends_at) > new Date();
          return this.badge(active ? 'активно' : 'завершено', active ? 'success' : '');
        },
      },
      { title: '', render: () => this.rowButton('Остановить', 'stop') },
    ];
  }

  async #load() {
    const data = await this.guard(() => api.get('/promotions', this.#query));
    if (data) this.#table.render(data);
  }

  async #create() {
    const placements = await this.guard(() => api.get('/promotions/placements'));
    if (!placements) return;
    const data = await this.modal.open({
      title: 'Новое размещение',
      fields: [
        { name: 'supplierId', label: 'ID поставщика', type: 'number', required: true },
        {
          name: 'placementId',
          label: 'Пакет размещения',
          type: 'select',
          options: placements.map((row) => ({
            value: row.id,
            label: `${row.name} — ${money(row.price)} / ${row.days} дн`,
          })),
        },
        { name: 'discountPct', label: 'Скидка за рекламу, %', type: 'number', value: 0 },
        { name: 'amountPaid', label: 'Оплачено (пусто — цена пакета)', type: 'number', step: '0.01' },
        { name: 'note', label: 'Комментарий' },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.post('/promotions', {
        supplierId: Number(data.supplierId),
        placementId: Number(data.placementId),
        discountPct: Number(data.discountPct || 0),
        amountPaid: data.amountPaid ? Number(data.amountPaid) : undefined,
        note: data.note || undefined,
      });
      this.toast.success('Размещение создано');
      await this.#load();
    });
  }

  async #editPlacement() {
    const data = await this.modal.open({
      title: 'Пакет размещения',
      fields: [
        { name: 'code', label: 'Код', required: true, hint: 'например top_month' },
        { name: 'name', label: 'Название', required: true },
        {
          name: 'slot',
          label: 'Слот',
          type: 'select',
          options: Object.entries(SLOT_LABELS).map(([value, label]) => ({ value, label })),
        },
        { name: 'weight', label: 'Вес (выше — раньше)', type: 'number', value: 300 },
        { name: 'days', label: 'Дней', type: 'number', value: 30 },
        { name: 'price', label: 'Цена', type: 'number', step: '0.01', value: 0 },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.put('/promotions/placements', {
        code: data.code,
        name: data.name,
        slot: data.slot,
        weight: Number(data.weight),
        days: Number(data.days),
        price: Number(data.price),
      });
      this.toast.success('Пакет сохранён');
    });
  }

  async #stop(id) {
    await this.guard(async () => {
      await api.post(`/promotions/${id}/stop`, {});
      this.toast.success('Размещение остановлено');
      await this.#load();
    });
  }
}
