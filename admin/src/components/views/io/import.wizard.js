import { api } from '../../../utils/api.js';
import { el, option } from '../../../utils/dom.js';

// Мастер импорта: файл → предпросмотр с дублями → сопоставление колонок → применение.
export class ImportWizard {
  #view;
  #root;
  #preview = null;

  constructor(view) {
    this.#view = view;
    this.#root = el('div', 'form');
  }

  get element() {
    return this.#root;
  }

  init() {
    this.#renderUpload();
    return this;
  }

  #renderUpload() {
    const row = el('div', 'form__row');
    const fileLabel = el('label', 'field');
    fileLabel.append(el('span', 'field__label', 'Файл .csv / .xlsx'));
    const file = el('input', 'field__input');
    file.type = 'file';
    file.accept = '.csv,.xls,.xlsx';
    fileLabel.append(file);

    const targetLabel = el('label', 'field');
    targetLabel.append(el('span', 'field__label', 'Что импортируем'));
    const target = el('select', 'field__select');
    target.append(option('suppliers', 'Поставщиков', true), option('offers', 'Предложения'));
    targetLabel.append(target);

    const submit = el('button', 'button button_primary', 'Загрузить и посмотреть');
    submit.type = 'button';
    submit.addEventListener('click', () => this.#upload(file.files?.[0], target.value));

    row.append(fileLabel, targetLabel, submit);
    this.#root.replaceChildren(row);
  }

  async #upload(file, target) {
    if (!file) {
      this.#view.toast.error(new Error('Выберите файл'));
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('target', target);
    const preview = await this.#view.guard(() => api.upload('/io/imports/preview', form));
    if (!preview) return;
    this.#preview = preview;
    this.#renderPreview();
  }

  #renderPreview() {
    const { headers, columns, suggestion, sample, duplicates } = this.#preview;
    const box = el('div', 'form');
    box.append(el('p', 'card__title', `Строк в файле: ${this.#preview.job.rows_total}`));
    box.append(this.#mappingRow(columns, headers, suggestion));
    box.append(el('p', 'field__label', 'Первые строки файла'));
    box.append(this.#sampleTable(headers, sample));
    if (duplicates?.length) {
      box.append(el('p', 'field__error',
        `Найдены дубли в базе: ${duplicates.map((row) => `${row.name} → #${row.matched_id} (${row.matched_by})`).join('; ')}`));
    }
    const apply = el('button', 'button button_primary', 'Применить импорт');
    apply.type = 'button';
    apply.addEventListener('click', () => this.#apply(box));
    const cancel = el('button', 'button', 'Отменить');
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.#renderUpload());
    const actions = el('div', 'form__actions');
    actions.append(cancel, apply);
    box.append(actions);
    this.#root.replaceChildren(box);
  }

  // Сопоставление: колонка базы → индекс колонки файла.
  #mappingRow(columns, headers, suggestion) {
    const row = el('div', 'form__row');
    for (const column of columns) {
      const label = el('label', 'field');
      label.append(el('span', 'field__label', column));
      const select = el('select', 'field__select');
      select.dataset.column = column;
      select.append(option('', '— не импортировать', suggestion[column] === undefined));
      headers.forEach((header, index) => {
        select.append(option(String(index), header, String(suggestion[column]) === String(index)));
      });
      label.append(select);
      row.append(label);
    }
    return row;
  }

  #sampleTable(headers, sample) {
    const scroll = el('div', 'table__scroll');
    const table = el('table', 'table__grid');
    const head = el('tr', 'table__head');
    head.append(...headers.map((header) => el('th', 'table__th', header)));
    table.append(head);
    for (const row of sample) {
      const tr = el('tr', 'table__row');
      tr.append(...headers.map((_, index) => el('td', 'table__td', row[index] ?? '')));
      table.append(tr);
    }
    scroll.append(table);
    return scroll;
  }

  async #apply(box) {
    const mapping = {};
    for (const select of box.querySelectorAll('[data-column]')) {
      if (select.value !== '') mapping[select.dataset.column] = Number(select.value);
    }
    const result = await this.#view.guard(() =>
      api.post(`/io/imports/${this.#preview.job.id}/apply`, { mapping }));
    if (!result) return;
    this.#view.toast.success(
      `Импорт завершён: создано ${result.rows_created}, обновлено ${result.rows_updated},`
      + ` пропущено ${result.rows_skipped}`);
    this.#preview = null;
    this.#renderUpload();
    await this.#view.mount();
  }
}
