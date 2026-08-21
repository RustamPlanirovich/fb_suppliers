import { api } from '../../../utils/api.js';
import { SUPPLIER_STATUS_LABELS, SUPPLIER_SOURCE_LABELS } from '../../../utils/constants.js';
import { dateTime } from '../../../utils/format.js';

const CONTACT_FIELDS = ['telegram', 'phone', 'email', 'website'];

// Создание и редактирование карточки поставщика + просмотр истории изменений.
export class SupplierEditor {
  #view;

  constructor(view) {
    this.#view = view;
  }

  async create() {
    const data = await this.#view.modal.open({
      title: 'Новый поставщик',
      fields: this.#fields({}),
    });
    if (!data) return;
    await this.#view.guard(async () => {
      await api.post('/suppliers', this.#payload(data));
      this.#view.toast.success('Поставщик создан');
      await this.#view.reload();
    });
  }

  async open(id) {
    const supplier = await this.#view.guard(() => api.get(`/suppliers/${id}`));
    if (!supplier) return;
    const history = await this.#history(id);
    const data = await this.#view.modal.open({
      title: `Поставщик: ${supplier.name}`,
      fields: [...this.#fields(supplier), history],
    });
    if (!data) return;
    await this.#view.guard(async () => {
      await api.patch(`/suppliers/${id}`, this.#payload(data));
      this.#view.toast.success('Изменения сохранены');
      await this.#view.reload();
    });
  }

  #fields(supplier) {
    return [
      { name: 'name', label: 'Название', value: supplier.name, required: true },
      {
        name: 'source',
        label: 'Источник',
        type: 'select',
        value: supplier.source ?? 'manual',
        options: Object.entries(SUPPLIER_SOURCE_LABELS).map(([value, text]) => ({ value, label: text })),
        hint: 'Для источника «Площадка» контакты не сохраняются — правила площадки',
      },
      {
        name: 'status',
        label: 'Статус',
        type: 'select',
        value: supplier.status ?? 'draft',
        options: Object.entries(SUPPLIER_STATUS_LABELS).map(([value, text]) => ({ value, label: text })),
      },
      { name: 'external_url', label: 'Ссылка на источник', value: supplier.external_url ?? '' },
      { name: 'telegram', label: 'Telegram', value: supplier.telegram ?? '' },
      { name: 'phone', label: 'Телефон', value: supplier.phone ?? '' },
      { name: 'email', label: 'Email', value: supplier.email ?? '' },
      { name: 'website', label: 'Сайт', value: supplier.website ?? '' },
      {
        name: 'quality_score',
        label: 'Оценка администрации (1–5)',
        type: 'number',
        value: supplier.quality_score ?? '',
      },
      { name: 'quality_note', label: 'Комментарий к оценке', type: 'textarea', value: supplier.quality_note ?? '' },
      { name: 'description', label: 'Описание', type: 'textarea', value: supplier.description ?? '' },
      { name: 'evidence', label: 'Откуда информация (доказательство)', value: '' },
      { name: 'is_hidden', label: 'Скрыт в боте', type: 'checkbox', value: supplier.is_hidden },
    ];
  }

  // История изменений карточки: кто, когда, что и на основании чего поменял.
  async #history(id) {
    const rows = await api.get(`/suppliers/${id}/history`).catch(() => []);
    const text = rows.length
      ? rows.map((row) =>
        `${dateTime(row.created_at)} · ${row.admin_name ?? 'система'} · ${row.action}`
        + `${row.comment ? ` · ${row.comment}` : ''}`).join('\n')
      : 'Изменений пока нет';
    return { name: '__history', label: 'История изменений', type: 'textarea', value: text };
  }

  #payload(data) {
    const payload = {
      name: data.name,
      source: data.source,
      status: data.status,
      description: data.description || null,
      external_url: data.external_url || null,
      quality_score: data.quality_score ? Number(data.quality_score) : null,
      quality_note: data.quality_note || null,
      is_hidden: Boolean(data.is_hidden),
      evidence: data.evidence || null,
    };
    for (const field of CONTACT_FIELDS) payload[field] = data[field] || null;
    return payload;
  }
}
