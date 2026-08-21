import { api } from '../../../utils/api.js';
import { el, option } from '../../../utils/dom.js';
import { num } from '../../../utils/format.js';
import { PreviewTable } from './preview.table.js';
import { NodePicker } from './node.picker.js';

// Мастер загрузки: игра → раздел → предпросмотр → выбор варианта → запись в базу.
export class SyncWizard {
  #view;
  #root;
  #node = null;
  #preview = null;
  #rules = [];
  #picker = null;

  constructor(view) {
    this.#view = view;
    this.#root = el('div', 'form');
  }

  get element() {
    return this.#root;
  }

  init() {
    this.#picker = new NodePicker(this.#view, (node) => this.#loadPreview(node));
    this.#showPicker();
    return this;
  }

  #showPicker() {
    this.#root.replaceChildren(this.#picker.render());
  }

  #field(label, control) {
    const wrapper = el('label', 'field');
    wrapper.append(el('span', 'field__label', label), control);
    return wrapper;
  }

  async #loadPreview(node, titleRules = []) {
    if (!node.nodeId) {
      this.#view.toast.error(new Error('Сначала выберите игру и раздел'));
      return;
    }
    this.#node = node;
    this.#view.toast.show('Читаю раздел площадки…');
    const preview = await this.#view.guard(() =>
      api.post('/funpay/preview', { nodeId: node.nodeId, titleRules }, { timeout: 60_000 }));
    if (!preview) return;
    this.#preview = preview;
    this.#rules = titleRules;
    this.#renderPreview();
  }

  // Правила вводятся построчно: «12 месяцев = 12 мес|12 month».
  #parseRules(text) {
    return String(text)
      .split('\n')
      .map((line) => line.split('='))
      .filter((parts) => parts.length >= 2 && parts[0].trim() && parts[1].trim())
      .map((parts) => ({ name: parts[0].trim(), contains: parts.slice(1).join('=').trim() }));
  }

  #renderPreview() {
    const { total, sellers, currency, availableAttrs } = this.#preview;
    const box = el('div', 'form');
    box.append(el('p', 'card__title',
      `${this.#node.gameName} · ${this.#node.nodeName}: предложений ${num(total)},`
      + ` продавцов ${num(sellers)}, валюта ${currency}`));

    if (this.#preview.needsRules) {
      box.append(el('p', 'field__error',
        'У раздела нет фильтров площадки: без правил всё попадёт в один вариант,'
        + ' а средняя цена по разнородным предложениям для расчёта маржи бесполезна.'));
    }

    const controls = el('div', 'form__row');
    const productName = el('input', 'field__input');
    productName.value = `${this.#node.gameName} ${this.#node.nodeName}`.trim();

    const attrs = el('select', 'field__select');
    attrs.multiple = availableAttrs.length > 1;
    attrs.size = Math.min(4, Math.max(2, availableAttrs.length));
    attrs.replaceChildren(...availableAttrs.map((attr) => option(attr, attr, true)));

    const status = el('select', 'field__select');
    status.replaceChildren(
      option('pending', 'На проверке — разобрать в очереди', true),
      option('verified', 'Сразу проверен — попадут в бота и в связки'),
      option('draft', 'Черновик — не показывать нигде'),
    );

    const withSellers = el('select', 'field__select');
    withSellers.replaceChildren(
      option('yes', 'Карточки продавцов + цены', true),
      option('no', 'Только рыночные цены'),
    );

    controls.append(
      this.#field('Название товара в базе', productName),
      this.#field('Что считать вариантом', attrs),
      this.#field('Статус карточек', status),
      this.#field('Что сохранять', withSellers),
    );
    const rules = el('textarea', 'field__textarea');
    rules.placeholder = '12 месяцев = 12 мес|1 год\n1 месяц = 1 мес|1 month';
    rules.value = this.#rules.map((rule) => `${rule.name} = ${rule.contains}`).join('\n');
    const applyRules = el('button', 'button', 'Пересчитать по правилам');
    applyRules.type = 'button';
    applyRules.addEventListener('click', () =>
      this.#loadPreview(this.#node, this.#parseRules(rules.value)));

    const rulesBox = el('div', 'form');
    rulesBox.append(
      this.#field('Разбить по названию (по строке на вариант: Название = подстрока|подстрока)', rules),
      applyRules,
    );
    box.append(controls, rulesBox, new PreviewTable().render(this.#preview.groups));

    const sync = el('button', 'button button_primary', 'Загрузить в базу');
    sync.type = 'button';
    const save = el('button', 'button', 'Сохранить раздел на автообновление');
    save.type = 'button';
    const back = el('button', 'button', 'Назад');
    back.type = 'button';
    back.addEventListener('click', () => this.#showPicker());

    const payload = () => ({
      nodeId: this.#node.nodeId,
      productName: productName.value,
      variantAttrs: [...attrs.selectedOptions].map((item) => item.value),
      titleRules: this.#parseRules(rules.value),
      sellerStatus: status.value,
      withSellers: withSellers.value === 'yes',
    });
    sync.addEventListener('click', () => this.#sync(payload()));
    save.addEventListener('click', () => this.#save(payload()));

    const actions = el('div', 'form__actions');
    actions.append(back, save, sync);
    box.append(actions);
    this.#root.replaceChildren(box);
  }

  async #sync(payload) {
    this.#view.toast.show('Загружаю, это занимает несколько секунд…');
    const result = await this.#view.guard(() =>
      api.post('/funpay/sync', payload, { timeout: 180_000 }));
    if (!result) return;
    this.#view.toast.success(
      `Готово: вариантов ${result.variants}, карточек создано ${result.suppliersCreated},`
      + ` предложений создано ${result.offersCreated}, обновлено ${result.offersUpdated}`);
  }

  async #save(payload) {
    const result = await this.#view.guard(() => api.post('/funpay/sources', {
      ...payload,
      gameName: this.#node.gameName,
      nodeName: this.#node.nodeName,
    }));
    if (!result) return;
    this.#view.toast.success('Раздел сохранён — будет обновляться автоматически');
    await this.#view.reload();
  }
}
