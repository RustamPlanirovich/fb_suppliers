import { api } from '../../utils/api.js';
import { el } from '../../utils/dom.js';
import { View } from './view.base.js';

// Тексты бота и FAQ: правки видны в боте без выкладки кода.
export class ContentView extends View {
  async mount() {
    const blocksCard = this.card('Тексты и баннеры бота', [
      { title: 'Новый блок', variant: 'button_primary', onClick: () => this.#editBlock() },
    ]);
    const faqCard = this.card('FAQ', [
      { title: 'Добавить вопрос', variant: 'button_primary', onClick: () => this.#createFaq() },
    ]);
    this.root.replaceChildren(blocksCard, faqCard);
    await this.#load();
  }

  async #load() {
    const [blocks, faq] = await Promise.all([
      this.guard(() => api.get('/content')),
      this.guard(() => api.get('/content/faq')),
    ]);
    const [blocksBody, faqBody] = this.root.querySelectorAll('.card__body');
    if (blocks) {
      blocksBody.replaceChildren(...blocks.map((block) => this.#row(
        `${block.key} — ${block.title ?? ''}`,
        block.body.slice(0, 120),
        () => this.#editBlock(block),
      )));
    }
    if (faq) {
      faqBody.replaceChildren(...(faq.length
        ? faq.map((entry) => this.#row(entry.question, entry.answer.slice(0, 120),
          () => this.#editFaq(entry)))
        : [el('p', 'empty', 'Вопросов пока нет')]));
    }
  }

  #row(title, text, onEdit) {
    const box = el('div', 'card');
    box.append(el('p', 'card__title', title), el('p', 'page__hint', text));
    const button = el('button', 'button button_small', 'Изменить');
    button.type = 'button';
    button.addEventListener('click', onEdit);
    box.append(button);
    return box;
  }

  async #editBlock(block = {}) {
    const data = await this.modal.open({
      title: block.key ? `Блок ${block.key}` : 'Новый блок',
      fields: [
        { name: 'key', label: 'Ключ', value: block.key ?? '', required: true },
        {
          name: 'type',
          label: 'Тип',
          type: 'select',
          value: block.type ?? 'text',
          options: [
            { value: 'text', label: 'Текст' },
            { value: 'banner', label: 'Баннер' },
            { value: 'button', label: 'Подпись кнопки' },
            { value: 'notification', label: 'Уведомление' },
            { value: 'terms', label: 'Условия подписки' },
          ],
        },
        { name: 'title', label: 'Заголовок', value: block.title ?? '' },
        { name: 'body', label: 'Текст', type: 'textarea', value: block.body ?? '', required: true },
        { name: 'mediaUrl', label: 'Ссылка на картинку', value: block.media_url ?? '' },
        { name: 'isActive', label: 'Активен', type: 'checkbox', value: block.is_active ?? true },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.put('/content', {
        key: data.key,
        type: data.type,
        title: data.title || null,
        body: data.body,
        mediaUrl: data.mediaUrl || null,
        isActive: Boolean(data.isActive),
      });
      this.toast.success('Сохранено');
      await this.#load();
    });
  }

  async #createFaq() {
    const data = await this.modal.open({
      title: 'Новый вопрос',
      fields: [
        { name: 'question', label: 'Вопрос', required: true },
        { name: 'answer', label: 'Ответ', type: 'textarea', required: true },
        { name: 'sortOrder', label: 'Порядок', type: 'number', value: 0 },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.post('/content/faq', {
        question: data.question, answer: data.answer, sortOrder: Number(data.sortOrder || 0),
      });
      this.toast.success('Вопрос добавлен');
      await this.#load();
    });
  }

  async #editFaq(entry) {
    const data = await this.modal.open({
      title: 'Вопрос FAQ',
      fields: [
        { name: 'question', label: 'Вопрос', value: entry.question, required: true },
        { name: 'answer', label: 'Ответ', type: 'textarea', value: entry.answer, required: true },
        { name: 'sortOrder', label: 'Порядок', type: 'number', value: entry.sort_order },
        { name: 'isActive', label: 'Активен', type: 'checkbox', value: entry.is_active },
      ],
    });
    if (!data) return;
    await this.guard(async () => {
      await api.patch(`/content/faq/${entry.id}`, {
        question: data.question,
        answer: data.answer,
        sortOrder: Number(data.sortOrder || 0),
        isActive: Boolean(data.isActive),
      });
      this.toast.success('Сохранено');
      await this.#load();
    });
  }
}
