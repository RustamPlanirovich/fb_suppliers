import { api } from '../../../utils/api.js';
import { el } from '../../../utils/dom.js';
import { DUPLICATE_FIELD_LABELS } from './duplicates.labels.js';

// Поиск дублей по телефону, Telegram, сайту, email и названию + объединение карточек.
export class DuplicatesPanel {
  #view;

  constructor(view) {
    this.#view = view;
  }

  async open() {
    const groups = await this.#view.guard(() => api.get('/suppliers/duplicates'));
    if (!groups) return;
    const card = this.#view.card('Дубли карточек', [
      { title: 'Назад к списку', onClick: () => this.#view.mount() },
    ]);
    const body = card.querySelector('.card__body');
    body.replaceChildren(...(groups.length
      ? groups.map((group) => this.#group(group))
      : [el('p', 'empty', 'Дублей не найдено')]));
    this.#view.root.replaceChildren(card);
  }

  #group(group) {
    const box = el('div', 'card');
    box.append(el('p', 'field__label',
      `${DUPLICATE_FIELD_LABELS[group.field]}: ${group.key} — ${group.count} карточек`));
    const list = el('div', 'card__grid');
    const [target, ...rest] = group.items;
    list.append(el('p', null, `Оставить: #${target.id} ${target.name}`));
    for (const item of rest) {
      const button = el('button', 'button button_small', `Объединить #${item.id} ${item.name}`);
      button.type = 'button';
      button.addEventListener('click', () => this.#merge(target.id, item.id));
      list.append(button);
    }
    box.append(list);
    return box;
  }

  async #merge(targetId, sourceId) {
    if (!confirm(`Перенести данные #${sourceId} в #${targetId}?`)) return;
    const result = await this.#view.guard(() =>
      api.post('/suppliers/duplicates/merge', { targetId, sourceId }));
    if (result) {
      this.#view.toast.success('Карточки объединены');
      await this.open();
    }
  }
}
