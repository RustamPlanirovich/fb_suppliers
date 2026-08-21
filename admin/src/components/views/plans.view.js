import { api } from '../../utils/api.js';
import { el } from '../../utils/dom.js';
import { money } from '../../utils/format.js';
import { View } from './view.base.js';

// Гибкие тарифы: администратор сам собирает набор возможностей из словаря PLAN_FEATURES.
export class PlansView extends View {
  #features = {};

  async mount() {
    this.#features = await this.guard(() => api.get('/subscriptions/features')) ?? {};
    const card = this.card('Тарифы', [
      { title: 'Новый тариф', variant: 'button_primary', onClick: () => this.#create() },
      { title: 'Промокоды', onClick: () => this.#promoCodes() },
      { title: 'Платежи', onClick: () => this.#payments() },
    ]);
    this.root.replaceChildren(card);
    await this.#load();
  }

  async #load() {
    const plans = await this.guard(() => api.get('/subscriptions/plans'));
    if (!plans) return;
    const body = this.root.querySelector('.card__body');
    body.replaceChildren(...plans.map((plan) => this.#planCard(plan)));
  }

  #planCard(plan) {
    const box = el('div', 'card');
    const title = `${plan.name} — ${money(plan.price)} / ${plan.days} дн`
      + `${plan.is_default ? ' · по умолчанию' : ''}${plan.is_active ? '' : ' · выключен'}`;
    box.append(el('p', 'card__title', title));
    const list = el('div', 'card__grid');
    for (const [key, meta] of Object.entries(this.#features)) {
      const value = plan.features?.[key];
      list.append(this.stat(meta.label, this.#featureValue(meta, value)));
    }
    const actions = el('div', 'card__actions');
    actions.append(
      this.#button('Изменить', () => this.#edit(plan)),
      this.#button('Сделать основным', () => this.#setDefault(plan.id)),
    );
    box.append(list, actions);
    return box;
  }

  #featureValue(meta, value) {
    if (meta.type === 'boolean') return value ? 'да' : 'нет';
    return value === 0 ? 'без лимита' : String(value ?? '—');
  }

  #button(title, onClick) {
    const button = el('button', 'button button_small', title);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  #fields(plan = {}) {
    const base = [
      { name: 'name', label: 'Название', value: plan.name ?? '', required: true },
      { name: 'price', label: 'Цена', type: 'number', step: '0.01', value: plan.price ?? 0 },
      { name: 'days', label: 'Дней', type: 'number', value: plan.days ?? 30 },
      { name: 'description', label: 'Описание', type: 'textarea', value: plan.description ?? '' },
      { name: 'isActive', label: 'Активен', type: 'checkbox', value: plan.is_active ?? true },
    ];
    const features = Object.entries(this.#features).map(([key, meta]) => ({
      name: `feature:${key}`,
      label: meta.label,
      type: meta.type === 'boolean' ? 'checkbox' : 'number',
      value: plan.features?.[key] ?? (meta.type === 'boolean' ? false : 0),
    }));
    return [...base, ...features];
  }

  #payload(data) {
    const features = {};
    for (const [key, meta] of Object.entries(this.#features)) {
      const raw = data[`feature:${key}`];
      features[key] = meta.type === 'boolean' ? Boolean(raw) : Number(raw || 0);
    }
    return {
      name: data.name,
      price: Number(data.price || 0),
      days: Number(data.days || 30),
      description: data.description || null,
      isActive: Boolean(data.isActive),
      features,
    };
  }

  async #create() {
    const data = await this.modal.open({
      title: 'Новый тариф',
      fields: [
        { name: 'code', label: 'Код (латиницей)', required: true, hint: 'например reseller_plus' },
        ...this.#fields(),
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.post('/subscriptions/plans', { code: data.code, ...this.#payload(data) });
      this.toast.success('Тариф создан');
      await this.#load();
    });
  }

  async #edit(plan) {
    const data = await this.modal.open({ title: `Тариф ${plan.name}`, fields: this.#fields(plan) });
    if (!data) return;
    await this.guard(async () => {
      await api.patch(`/subscriptions/plans/${plan.id}`, this.#payload(data));
      this.toast.success('Тариф обновлён');
      await this.#load();
    });
  }

  async #setDefault(id) {
    await this.guard(async () => {
      await api.post(`/subscriptions/plans/${id}/default`, {});
      this.toast.success('Тариф по умолчанию изменён');
      await this.#load();
    });
  }

  async #promoCodes() {
    const codes = await this.guard(() => api.get('/subscriptions/promocodes'));
    if (!codes) return;
    const data = await this.modal.open({
      title: 'Промокоды',
      submitText: 'Создать',
      fields: [
        {
          name: '__list',
          label: 'Существующие',
          type: 'textarea',
          value: codes.map((row) =>
            `${row.code} · скидка ${row.discount_pct}% · +${row.bonus_days} дн · использован ${row.used_count}`)
            .join('\n') || 'Пока нет',
        },
        { name: 'code', label: 'Новый код' },
        { name: 'discountPct', label: 'Скидка, %', type: 'number', value: 0 },
        { name: 'bonusDays', label: 'Бонусных дней', type: 'number', value: 0 },
        { name: 'maxUses', label: 'Лимит использований', type: 'number' },
      ],
    });
    if (!data?.code) return;
    await this.guard(async () => {
      await api.post('/subscriptions/promocodes', {
        code: data.code,
        discountPct: Number(data.discountPct || 0),
        bonusDays: Number(data.bonusDays || 0),
        maxUses: data.maxUses ? Number(data.maxUses) : null,
      });
      this.toast.success('Промокод создан');
    });
  }

  async #payments() {
    const data = await this.guard(() => api.get('/subscriptions/payments', { limit: 50 }));
    if (!data) return;
    await this.modal.open({
      title: 'История платежей',
      submitText: 'Закрыть',
      fields: [{
        name: '__payments',
        label: 'Последние 50',
        type: 'textarea',
        value: data.items.map((row) =>
          `${new Date(row.created_at).toLocaleString('ru-RU')} · ${row.username ?? row.telegram_id}`
          + ` · ${money(row.amount)} · ${row.status}`).join('\n') || 'Платежей пока нет',
      }],
    });
  }
}
