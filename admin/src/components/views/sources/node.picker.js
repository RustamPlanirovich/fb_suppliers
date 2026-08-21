import { api } from '../../../utils/api.js';
import { el, option } from '../../../utils/dom.js';

// Выбор раздела площадки: поиск игры → список её разделов.
// Наружу отдаёт выбранный раздел коллбэком, ничего не знает о синхронизации.
export class NodePicker {
  #view;
  #onPick;
  #games = [];

  constructor(view, onPick) {
    this.#view = view;
    this.#onPick = onPick;
  }

  render() {
    const search = el('input', 'field__input');
    search.placeholder = 'Название игры или сервиса, например Spotify';
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
    row.append(this.#field('Поиск игры', search), this.#field('Игра', games), this.#field('Раздел', nodes));
    const actions = el('div', 'form__actions');
    actions.append(find, pick);

    const box = el('div', 'form');
    box.append(row, actions);
    return box;
  }

  async #find(text, games, nodes) {
    const found = await this.#view.guard(() => api.get('/funpay/games', { q: text }));
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
