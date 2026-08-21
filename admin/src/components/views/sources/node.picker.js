import { api } from '../../../utils/api.js';
import { el, option } from '../../../utils/dom.js';

// Выбор раздела площадки: поиск игры → список её разделов.
// Наружу отдаёт выбранный раздел коллбэком, ничего не знает о синхронизации.
export class NodePicker {
  #view;
  #onPick;
  #games = [];
  #providers = [];
  #provider = 'funpay';

  constructor(view, onPick, providers = []) {
    this.#view = view;
    this.#onPick = onPick;
    this.#providers = providers;
    this.#provider = providers[0]?.code ?? 'funpay';
  }

  render() {
    const source = el('select', 'field__select');
    source.replaceChildren(...this.#providers.map((item) =>
      option(item.code, item.title, item.code === this.#provider)));

    const search = el('input', 'field__input');
    search.placeholder = this.#hint();
    source.addEventListener('change', () => {
      this.#provider = source.value;
      search.placeholder = this.#hint();
      this.#games = [];
    });
    const games = el('select', 'field__select');
    const nodes = el('select', 'field__select');

    games.addEventListener('change', () => this.#fillNodes(games, nodes));

    const find = el('button', 'button button_primary', 'Найти');
    find.type = 'button';
    find.addEventListener('click', () => this.#find(search.value, games, nodes));

    const pick = el('button', 'button', 'Посмотреть, что там');
    pick.type = 'button';
    pick.addEventListener('click', () => this.#pick(games, nodes));

    const row = el('div', 'form__row');
    row.append(
      this.#field('Площадка', source),
      this.#field('Что искать', search),
      this.#field('Игра или магазин', games),
      this.#field('Раздел', nodes),
    );
    const actions = el('div', 'form__actions');
    actions.append(find, pick);

    const box = el('div', 'form');
    box.append(row, actions);
    return box;
  }

  #hint() {
    return this.#providers.find((item) => item.code === this.#provider)?.catalogHint
      ?? 'Название игры или сервиса';
  }

  get provider() {
    return this.#provider;
  }

  async #find(text, games, nodes) {
    const found = await this.#view.guard(() =>
      api.get(`/sources/${this.#provider}/games`, { q: text }));
    if (!found) return;
    this.#games = found;
    games.replaceChildren(...found.map((game) =>
      option(game.gameId, `${game.name} (${game.nodes.length})`)));
    this.#fillNodes(games, nodes);
  }

  #fillNodes(games, nodes) {
    const game = this.#games.find((item) => item.gameId === games.value);
    nodes.replaceChildren(...(game?.nodes ?? []).map((node) => option(node.nodeId, node.name)));
  }

  #pick(games, nodes) {
    const game = this.#games.find((item) => item.gameId === games.value);
    if (!game || !nodes.value) {
      this.#view.toast.error(new Error('Сначала выберите игру и раздел'));
      return;
    }
    this.#onPick({
      provider: this.#provider,
      nodeId: nodes.value,
      gameName: game.name,
      nodeName: nodes.options[nodes.selectedIndex]?.text ?? '',
    });
  }

  #field(label, control) {
    const wrapper = el('label', 'field');
    wrapper.append(el('span', 'field__label', label), control);
    return wrapper;
  }
}
