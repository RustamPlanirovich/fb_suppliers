import { el } from '../../utils/dom.js';

// Модальное окно на нативном <dialog>: фокус-ловушка, Esc и ::backdrop — бесплатно.
// Форма собирается из описания полей, результат возвращается промисом.
export class Modal {
  #dialog;
  #title;
  #form;
  #resolve = null;

  constructor(dialog) {
    this.#dialog = dialog;
    this.#title = dialog.querySelector('.modal__title');
    this.#form = dialog.querySelector('.modal__body');
  }

  init() {
    this.#dialog.querySelector('.modal__close').addEventListener('click', () => this.#close(null));
    this.#dialog.querySelector('.modal__cancel').addEventListener('click', () => this.#close(null));
    this.#dialog.querySelector('.modal__submit').addEventListener('click', () => this.#submit());
    this.#form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#submit();
    });
    return this;
  }

  // fields: [{ name, label, type, options, value, required, hint }]
  open({ title, fields, submitText = 'Сохранить' }) {
    this.#title.textContent = title;
    this.#form.replaceChildren(...fields.map((field) => this.#buildField(field)));
    this.#dialog.querySelector('.modal__submit').textContent = submitText;
    this.#dialog.showModal();
    return new Promise((resolve) => { this.#resolve = resolve; });
  }

  #buildField(field) {
    if (field.type === 'checkbox') return this.#buildCheckbox(field);
    const wrapper = el('label', 'field');
    wrapper.append(el('span', 'field__label', field.label));
    wrapper.append(field.type === 'select' ? this.#buildSelect(field) : this.#buildInput(field));
    if (field.hint) wrapper.append(el('span', 'field__label', field.hint));
    return wrapper;
  }

  #buildInput(field) {
    const isArea = field.type === 'textarea';
    const input = el(isArea ? 'textarea' : 'input', isArea ? 'field__textarea' : 'field__input');
    if (!isArea) input.type = field.type ?? 'text';
    input.name = field.name;
    input.value = field.value ?? '';
    if (field.required) input.required = true;
    if (field.step) input.step = field.step;
    return input;
  }

  #buildSelect(field) {
    const select = el('select', 'field__select');
    select.name = field.name;
    for (const item of field.options ?? []) {
      const node = el('option', null, item.label);
      node.value = item.value;
      if (String(item.value) === String(field.value)) node.selected = true;
      select.append(node);
    }
    return select;
  }

  #buildCheckbox(field) {
    const wrapper = el('label', 'field__checkbox');
    const input = el('input', 'field__input_checkbox visually-hidden');
    input.type = 'checkbox';
    input.name = field.name;
    input.checked = Boolean(field.value);
    wrapper.append(input, el('span', 'field__box'), el('span', null, field.label));
    return wrapper;
  }

  #submit() {
    if (!this.#form.reportValidity()) return;
    const data = {};
    for (const element of this.#form.elements) {
      if (!element.name) continue;
      data[element.name] = element.type === 'checkbox' ? element.checked : element.value;
    }
    this.#close(data);
  }

  #close(result) {
    this.#dialog.close();
    this.#resolve?.(result);
    this.#resolve = null;
  }
}
