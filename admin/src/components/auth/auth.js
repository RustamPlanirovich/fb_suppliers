import { api } from '../../utils/api.js';
import { emit } from '../../utils/dom.js';
import { EVENTS } from '../../utils/constants.js';

// Экран входа. Наружу сообщает событием app:auth с профилем администратора.
export class Auth {
  #root;
  #form;
  #error;

  constructor(root) {
    this.#root = root;
    this.#form = root.querySelector('form');
    this.#error = root.querySelector('.login__error');
  }

  init() {
    this.#form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#login();
    });
    return this;
  }

  show() {
    this.#root.hidden = false;
  }

  hide() {
    this.#root.hidden = true;
  }

  async #login() {
    this.#error.hidden = true;
    const data = new FormData(this.#form);
    try {
      const admin = await api.post('/auth/login', {
        email: data.get('email'),
        password: data.get('password'),
      });
      this.#form.reset();
      emit(this.#root, EVENTS.AUTH, { admin });
    } catch (err) {
      this.#error.textContent = err.message;
      this.#error.hidden = false;
    }
  }
}
