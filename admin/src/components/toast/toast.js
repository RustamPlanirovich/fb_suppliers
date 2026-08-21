import { el } from '../../utils/dom.js';
import { TOAST_TIMEOUT_MS } from '../../utils/constants.js';

// Всплывающие уведомления. Показываются через toast.show(), ошибок — toast.error().
export class Toast {
  #root;

  constructor(root) {
    this.#root = root;
  }

  show(message, kind = '') {
    const item = el('div', `toast__item${kind ? ` toast__item_${kind}` : ''}`, message);
    this.#root.append(item);
    setTimeout(() => item.remove(), TOAST_TIMEOUT_MS);
  }

  success(message) {
    this.show(message, 'success');
  }

  error(error) {
    this.show(error?.message ?? String(error), 'error');
  }
}
