import { el, emit } from '../../utils/dom.js';
import { EVENTS } from '../../utils/constants.js';

// Панель фильтров: описание полей → форма → событие filters:change со значениями.
export class Filters {
  #root;
  #fields;

  constructor(fields) {
    this.#fields = fields;
    this.#root = el('form', 'filters');
  }

  get element() {
    return this.#root;
  }

  init() {
    this.#root.replaceChildren(...this.#fields.map((field) => this.#build(field)), this.#actions());
    this.#root.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#apply();
    });
    this.#root.addEventListener('change', (event) => {
      if (event.target.matches('select')) this.#apply();
    });
    return this;
  }

  get values() {
    const data = {};
    for (const element of this.#root.elements) {
      if (!element.name || !element.value) continue;
      data[element.name] = element.type === 'checkbox' ? element.checked : element.value;
    }
    return data;
  }

  #build(field) {
    const wrapper = el('label', 'field');
    wrapper.append(el('span', 'field__label', field.label));
    if (field.type === 'select') {
      const select = el('select', 'field__select');
      select.name = field.name;
      select.append(...[{ value: '', label: field.placeholder ?? 'Все' }, ...(field.options ?? [])]
        .map((item) => {
          const option = el('option', null, item.label);
          option.value = item.value;
          // Начальное значение фильтра должно совпадать с тем, что уже применено к списку.
          if (field.value !== undefined && String(item.value) === String(field.value)) {
            option.selected = true;
          }
          return option;
        }));
      wrapper.append(select);
      return wrapper;
    }
    const input = el('input', 'field__input');
    input.type = field.type ?? 'text';
    input.name = field.name;
    input.placeholder = field.placeholder ?? '';
    if (field.value !== undefined) input.value = field.value;
    wrapper.append(input);
    return wrapper;
  }

  #actions() {
    const box = el('div', 'filters__actions');
    const apply = el('button', 'button button_primary', 'Применить');
    apply.type = 'submit';
    const reset = el('button', 'button', 'Сбросить');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      this.#root.reset();
      this.#apply();
    });
    box.append(apply, reset);
    return box;
  }

  #apply() {
    emit(this.#root, EVENTS.FILTERS_CHANGE, { values: this.values });
  }
}
