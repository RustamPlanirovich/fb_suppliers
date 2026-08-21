import { api } from '../../../utils/api.js';
import { el, option } from '../../../utils/dom.js';
import { num } from '../../../utils/format.js';

// Быстрое подключение магазинов: список ссылок или ID — по строке на магазин.
export class ShopsPanel {
  #view;
  #providers = [];

  constructor(view) {
    this.#view = view;
  }

  render(providers) {
    this.#providers = providers;
    const card = this.#view.card('Подключить магазины списком');
    const body = card.querySelector('.card__body');

    const source = el('select', 'field__select');
    source.replaceChildren(...providers.map((item) => option(item.code, item.title)));
    source.value = providers.some((item) => item.code === 'digiseller') ? 'digiseller' : providers[0]?.code;

    const items = el('textarea', 'field__textarea');
    items.placeholder = 'По одной ссылке или ID в строке:\n'
      + 'https://plati.market/itm/chatgpt/5988103\n1397753';

    const status = el('select', 'field__select');
    status.replaceChildren(
      option('verified', 'Сразу проверен — сразу видны в боте', true),
      option('pending', 'На проверке — разобрать в очереди'),
    );

    const rules = el('textarea', 'field__textarea');
    rules.placeholder = 'Необязательно. По строке на вариант:\nChatGPT = chatgpt|gpt\nПочты = mail|почт';

    const save = el('select', 'field__select');
    save.replaceChildren(
      option('yes', 'Загрузить и обновлять по расписанию', true),
      option('no', 'Только загрузить сейчас'),
    );

    const row = el('div', 'form__row');
    row.append(
      this.#field('Площадка', source),
      this.#field('Статус карточек', status),
      this.#field('Что делать дальше', save),
    );

    const submit = el('button', 'button button_primary', 'Подключить');
    submit.type = 'button';
    const result = el('div', 'card__body');
    submit.addEventListener('click', () => this.#connect({
      provider: source.value, items: items.value, status: status.value,
      rules: rules.value, save: save.value === 'yes', submit, result,
    }));

    const actions = el('div', 'form__actions');
    actions.append(submit);
    body.append(
      row,
      this.#field('Магазины: ссылки или ID', items),
      this.#field('Разбить товары по названию', rules),
      actions,
      result,
    );
    return card;
  }

  #field(label, control) {
    const wrapper = el('label', 'field');
    wrapper.append(el('span', 'field__label', label), control);
    return wrapper;
  }

  #parseRules(text) {
    return String(text).split('\n')
      .map((line) => line.split('='))
      .filter((parts) => parts.length >= 2 && parts[0].trim() && parts[1].trim())
      .map((parts) => ({ name: parts[0].trim(), contains: parts.slice(1).join('=').trim() }));
  }

  async #connect({ provider, items, status, rules, save, submit, result }) {
    const list = String(items).split('\n').map((line) => line.trim()).filter(Boolean);
    if (!list.length) {
      this.#view.toast.error(new Error('Вставьте хотя бы одну ссылку или ID'));
      return;
    }
    submit.disabled = true;
    submit.textContent = `Подключаю ${list.length}…`;
    const data = await this.#view.guard(() => api.post(`/sources/${provider}/shops`, {
      items: list, sellerStatus: status, titleRules: this.#parseRules(rules), save,
    }, { timeout: 900_000 }));
    submit.disabled = false;
    submit.textContent = 'Подключить';
    if (!data) return;

    this.#view.toast.success(`Подключено магазинов: ${data.connected}, с ошибкой: ${data.failed}`);
    result.replaceChildren(...data.shops.map((shop) => el(
      'p',
      shop.ok ? null : 'field__error',
      shop.ok
        ? `✔ ${shop.shop}: позиций ${num(shop.offers)}, карточек ${num(shop.suppliers)}`
        : `✘ ${shop.input}: ${shop.error}`,
    )));
    await this.#view.reload();
  }
}
