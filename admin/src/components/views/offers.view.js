import { api } from '../../utils/api.js';
import { EVENTS } from '../../utils/constants.js';
import { ago, money, num } from '../../utils/format.js';
import { Table } from '../table/table.js';
import { Filters } from '../filters/filters.js';
import { View } from './view.base.js';

// Предложения поставщиков: цена, свежесть, история. Правка цены требует доказательства.
export class OffersView extends View {
  #table;
  #query = { sort: 'price' };

  async mount() {
    const filters = new Filters([
      { name: 'q', label: 'Поиск', placeholder: 'Товар, вариант, заголовок' },
      { name: 'supplierId', label: 'ID поставщика', type: 'number' },
      { name: 'variantId', label: 'ID варианта', type: 'number' },
      { name: 'staleDays', label: 'Цена старше, дней', type: 'number', placeholder: '7' },
      {
        name: 'sort',
        label: 'Сортировка',
        type: 'select',
        placeholder: 'По цене',
        options: [
          { value: 'fresh', label: 'По свежести цены' },
          { value: 'reliability', label: 'По надёжности' },
          { value: 'updated', label: 'По изменению' },
        ],
      },
    ]).init();

    this.#table = new Table({
      columns: this.#columns(),
      onRowClick: (id) => this.#editPrice(Number(id)),
    }).init();

    const card = this.card('Предложения', [
      { title: 'Добавить', variant: 'button_primary', onClick: () => this.#create() },
    ]);
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
      if (event.detail.action === 'history') this.#showHistory(Number(event.detail.ids[0]));
    });
    await this.#load();
  }

  #columns() {
    return [
      { title: 'Товар', key: 'product_name' },
      { title: 'Вариант', key: 'variant_name' },
      { title: 'Поставщик', key: 'supplier_name' },
      { title: 'Цена', render: (row) => money(row.price) },
      { title: 'Была', render: (row) => money(row.prev_price) },
      { title: 'Свежесть', render: (row) => ago(row.price_checked_at) },
      { title: 'Надёжность', render: (row) => num(row.score_reliability) },
      {
        title: 'Активно',
        render: (row) => this.badge(row.is_active ? 'да' : 'нет', row.is_active ? 'success' : 'danger'),
      },
      { title: '', render: () => this.rowButton('История', 'history') },
    ];
  }

  async #load() {
    const data = await this.guard(() => api.get('/offers', this.#query));
    if (data) this.#table.render(data);
  }

  async #create() {
    const data = await this.modal.open({
      title: 'Новое предложение',
      fields: [
        { name: 'supplierId', label: 'ID поставщика', type: 'number', required: true },
        { name: 'variantId', label: 'ID варианта', type: 'number', required: true },
        { name: 'title', label: 'Заголовок' },
        { name: 'price', label: 'Цена закупки', type: 'number', step: '0.01', required: true },
        { name: 'url', label: 'Ссылка' },
        { name: 'evidence', label: 'Откуда информация', required: true },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.post('/offers', {
        supplierId: Number(data.supplierId),
        variantId: Number(data.variantId),
        title: data.title || null,
        price: Number(data.price),
        url: data.url || null,
        evidence: data.evidence,
      });
      this.toast.success('Предложение добавлено');
      await this.#load();
    });
  }

  async #editPrice(id) {
    const offer = await this.guard(() => api.get(`/offers/${id}`));
    if (!offer) return;
    const data = await this.modal.open({
      title: `Цена: ${offer.product_name} — ${offer.supplier_name}`,
      fields: [
        { name: 'price', label: 'Новая цена', type: 'number', step: '0.01', value: offer.price, required: true },
        {
          name: 'source',
          label: 'Источник данных',
          type: 'select',
          value: 'admin',
          options: [
            { value: 'admin', label: 'Проверил администратор' },
            { value: 'parser', label: 'Парсер' },
            { value: 'user', label: 'Сообщение пользователя' },
            { value: 'import', label: 'Импорт' },
          ],
        },
        { name: 'evidence', label: 'Доказательство', required: true, hint: 'Например: сообщение поставщика' },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.post(`/offers/${id}/price`,
        { price: Number(data.price), source: data.source, evidence: data.evidence });
      this.toast.success('Цена обновлена');
      await this.#load();
    });
  }

  async #showHistory(id) {
    const rows = await this.guard(() => api.get(`/offers/${id}/history`));
    if (!rows) return;
    await this.modal.open({
      title: 'История цены',
      submitText: 'Закрыть',
      fields: [{
        name: '__history',
        label: 'Изменения',
        type: 'textarea',
        value: rows.length
          ? rows.map((row) => `${new Date(row.created_at).toLocaleString('ru-RU')} · ${money(row.price)}`
            + ` · ${row.source}${row.evidence ? ` · ${row.evidence}` : ''}`).join('\n')
          : 'Изменений пока нет',
      }],
    });
  }
}
