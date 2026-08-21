// Единственная входная точка JS. Здесь — и только здесь — инициализируются все компоненты.
import { api } from './utils/api.js';
import { logger } from './utils/logger.js';
import { EVENTS } from './utils/constants.js';
import { Toast } from './components/toast/toast.js';
import { Modal } from './components/modal/modal.js';
import { Auth } from './components/auth/auth.js';
import { App } from './components/app/app.js';

const toast = new Toast(document.querySelector('.toast'));
const modal = new Modal(document.querySelector('.modal')).init();
const auth = new Auth(document.querySelector('.login')).init();
const app = new App(document.querySelector('.app'), { toast, modal }).init();

document.addEventListener(EVENTS.AUTH, (event) => {
  auth.hide();
  app.show(event.detail.admin);
});

// При загрузке проверяем действующую сессию: есть — сразу в админку, нет — форма входа.
try {
  const admin = await api.get('/auth/me');
  auth.hide();
  app.show(admin);
} catch {
  app.hide();
  auth.show();
}

logger.info('Админка запущена');
