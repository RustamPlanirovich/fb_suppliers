import { clone, el } from '../../utils/dom.js';

// База для экранов админки: общая разметка карточки и доступ к общим сервисам.
export class View {
  constructor({ toast, modal, params = {} }) {
    this.toast = toast;
    this.modal = modal;
    // Параметры маршрута из hash: например `#suppliers?q=текст`.
    this.params = params;
    this.root = el('div', 'app__view');
  }

  get element() {
    return this.root;
  }

  // Каждый экран реализует mount(): наполняет this.root и грузит данные.
  async mount() {
    throw new Error('mount() не реализован');
  }

  unmount() {}

  card(title, actions = []) {
    const node = clone('tpl-card').querySelector('.card');
    node.querySelector('.card__title').textContent = title;
    const box = node.querySelector('.card__actions');
    for (const action of actions) {
      const button = el('button', `button ${action.variant ?? ''}`.trim(), action.title);
      button.type = 'button';
      button.addEventListener('click', action.onClick);
      box.append(button);
    }
    return node;
  }

  // hint: строка либо { text, direction: 'up' | 'down' } — подпись изменения под значением.
  stat(label, value, hint = '', modifier = '') {
    const node = clone('tpl-stat').querySelector('.stat');
    if (modifier) node.classList.add(`stat_${modifier}`);
    node.querySelector('.stat__label').textContent = label;
    node.querySelector('.stat__value').textContent = value;
    const hintNode = node.querySelector('.stat__hint');
    if (typeof hint === 'string') {
      hintNode.textContent = hint;
    } else if (hint) {
      hintNode.classList.add(`delta_${hint.direction}`);
      hintNode.textContent = `${hint.direction === 'down' ? '↓' : '↑'} ${hint.text}`;
    }
    return node;
  }

  // Полоса заполнения: доля, ROI, прогресс.
  progress(percent, modifier = '') {
    const box = el('div', 'progress');
    const track = el('div', 'progress__track');
    const bar = el('div', `progress__bar${modifier ? ` progress__bar_${modifier}` : ''}`);
    bar.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
    track.append(bar);
    box.append(track);
    return box;
  }

  badge(text, modifier = '') {
    return el('span', `badge${modifier ? ` badge_${modifier}` : ''}`, text);
  }

  rowButton(title, action, variant = 'button_small') {
    const button = el('button', `button ${variant}`, title);
    button.type = 'button';
    button.dataset.action = action;
    return button;
  }

  buttons(...nodes) {
    const box = el('div', 'card__actions');
    box.append(...nodes);
    return box;
  }

  async guard(fn) {
    try {
      return await fn();
    } catch (err) {
      this.toast.error(err);
      return null;
    }
  }
}
