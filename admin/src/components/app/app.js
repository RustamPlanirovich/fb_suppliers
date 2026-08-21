import { api } from '../../utils/api.js';
import { el } from '../../utils/dom.js';
import { icon, initials } from '../../utils/icons.js';
import { DEFAULT_ROUTE, ROUTES } from '../../utils/constants.js';
import { VIEWS } from './views.registry.js';

// Каркас админки: рельс разделов, шапка с поиском, текущий экран.
// Маршрут — в hash: `#suppliers?q=текст`.
export class App {
  #root;
  #nav;
  #title;
  #container;
  #search;
  #deps;
  #current = null;

  constructor(root, deps) {
    this.#root = root;
    this.#deps = deps;
    this.#nav = root.querySelector('.sidebar__nav');
    this.#title = root.querySelector('.topbar__title');
    this.#container = root.querySelector('.app__view');
    this.#search = root.querySelector('.search__input');
  }

  init() {
    this.#renderNav();
    this.#root.querySelector('.topbar__logout').addEventListener('click', () => this.#logout());
    this.#root.querySelector('.search__clear').addEventListener('click', () => this.#clearSearch());
    this.#search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.#submitSearch();
    });
    window.addEventListener('hashchange', () => this.#openRoute());
    return this;
  }

  show(admin) {
    this.#root.hidden = false;
    this.#root.querySelector('.topbar__name').textContent = `${admin.name} · ${admin.role}`;
    this.#root.querySelector('.topbar__avatar').textContent = initials(admin.name);
    this.#openRoute();
  }

  hide() {
    this.#root.hidden = true;
  }

  #renderNav() {
    this.#nav.replaceChildren(...ROUTES.map((route) => {
      const button = el('button', 'sidebar__link');
      button.type = 'button';
      button.dataset.route = route.id;
      button.title = route.title;
      button.setAttribute('aria-label', route.title);
      button.append(icon(route.id, 'sidebar__icon'), el('span', 'sidebar__tip', route.title));
      button.addEventListener('click', () => { location.hash = route.id; });
      return button;
    }));
  }

  // `#route?param=value` → { id, params }
  #parseHash() {
    const [rawId, rawQuery] = location.hash.replace('#', '').split('?');
    const id = ROUTES.some((route) => route.id === rawId) ? rawId : DEFAULT_ROUTE;
    return { id, params: Object.fromEntries(new URLSearchParams(rawQuery ?? '')) };
  }

  async #openRoute() {
    const { id, params } = this.#parseHash();
    const route = ROUTES.find((item) => item.id === id);
    for (const link of this.#nav.querySelectorAll('.sidebar__link')) {
      link.classList.toggle('sidebar__link_active', link.dataset.route === id);
    }
    this.#title.textContent = route.title;
    if (params.q !== undefined) this.#search.value = params.q;

    this.#current?.unmount();
    const ViewClass = VIEWS[id];
    this.#current = new ViewClass({ ...this.#deps, params });
    this.#container.replaceChildren(this.#current.element);
    await this.#current.mount();
  }

  // Поиск из шапки ведёт в реестр поставщиков с этим запросом.
  #submitSearch() {
    const value = this.#search.value.trim();
    location.hash = value ? `suppliers?q=${encodeURIComponent(value)}` : 'suppliers';
  }

  #clearSearch() {
    this.#search.value = '';
    this.#submitSearch();
  }

  async #logout() {
    await api.post('/auth/logout', {}).catch(() => {});
    location.reload();
  }
}
