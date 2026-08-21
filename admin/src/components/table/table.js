import { clone, el, emit } from '../../utils/dom.js';
import { EVENTS } from '../../utils/constants.js';
import { TableSelection } from './selection/selection.js';

// Универсальная таблица: колонки-описания, выделение строк, массовые действия, пагинация.
// Наружу общается только событиями: table:action, table:page, table:select.
export class Table {
  #root;
  #columns;
  #bulkActions;
  #selection;
  #body;
  #page = 1;
  #pages = 1;

  constructor({ columns, bulkActions = [], selectable = false, onRowClick = null }) {
    this.#root = clone('tpl-table').querySelector('.table');
    this.#columns = columns;
    this.#bulkActions = bulkActions;
    this.#selection = new TableSelection(selectable);
    this.#body = this.#root.querySelector('.table__body');
    this.onRowClick = onRowClick;
  }

  get element() {
    return this.#root;
  }

  init() {
    this.#renderHead();
    this.#renderBulk();
    this.#root.querySelector('.pager__prev').addEventListener('click', () => this.#turn(-1));
    this.#root.querySelector('.pager__next').addEventListener('click', () => this.#turn(1));
    this.#body.addEventListener('click', (event) => this.#onBodyClick(event));
    this.#body.addEventListener('change', (event) => this.#onCheck(event));
    return this;
  }

  render({ items, page = 1, pages = 1, total = 0 }) {
    this.#page = page;
    this.#pages = pages;
    this.#selection.clear();
    this.#updateBulk();
    this.#root.querySelector('.pager__info').textContent =
      `Стр. ${page} из ${pages} · всего ${total}`;
    this.#body.replaceChildren(...items.map((item) => this.#renderRow(item)));
    if (!items.length) this.#body.append(this.#emptyRow());
  }

  #renderHead() {
    const row = this.#root.querySelector('.table__head-row');
    const cells = this.#columns.map((column) => el('th', 'table__th', column.title));
    if (this.#selection.enabled) cells.unshift(el('th', 'table__th', ''));
    row.replaceChildren(...cells);
  }

  #renderRow(item) {
    const row = el('tr', 'table__row');
    row.dataset.id = item.id;
    if (this.#selection.enabled) row.append(this.#checkboxCell(item.id));
    for (const column of this.#columns) {
      const cell = el('td', 'table__td');
      const content = column.render ? column.render(item) : item[column.key];
      if (content instanceof Node) cell.append(content);
      else cell.textContent = content ?? '—';
      row.append(cell);
    }
    return row;
  }

  #checkboxCell(id) {
    const cell = el('td', 'table__td');
    const wrapper = el('label', 'field__checkbox');
    const input = el('input', 'field__input_checkbox visually-hidden');
    input.type = 'checkbox';
    input.dataset.select = String(id);
    wrapper.append(input, el('span', 'field__box'));
    cell.append(wrapper);
    return cell;
  }

  #emptyRow() {
    const row = el('tr');
    const cell = el('td', 'table__td empty', 'Ничего не найдено');
    cell.colSpan = this.#columns.length + (this.#selection.enabled ? 1 : 0);
    row.append(cell);
    return row;
  }

  #renderBulk() {
    const container = this.#root.querySelector('.table__bulk-actions');
    container.replaceChildren(...this.#bulkActions.map((action) => {
      const button = el('button', 'button button_small', action.title);
      button.type = 'button';
      button.addEventListener('click', () => emit(this.#root, EVENTS.TABLE_ACTION, {
        action: action.id, ids: this.#selection.ids,
      }));
      return button;
    }));
  }

  #onBodyClick(event) {
    if (event.target.closest('.field__checkbox')) return;
    const button = event.target.closest('[data-action]');
    const row = event.target.closest('.table__row');
    if (!row) return;
    if (button) {
      emit(this.#root, EVENTS.TABLE_ACTION, { action: button.dataset.action, ids: [row.dataset.id] });
      return;
    }
    this.onRowClick?.(row.dataset.id);
  }

  #onCheck(event) {
    const input = event.target.closest('[data-select]');
    if (!input) return;
    this.#selection.toggle(input.dataset.select, input.checked);
    input.closest('.table__row').classList.toggle('table__row_selected', input.checked);
    this.#updateBulk();
    emit(this.#root, EVENTS.TABLE_SELECT, { ids: this.#selection.ids });
  }

  #updateBulk() {
    const bulk = this.#root.querySelector('.table__bulk');
    const count = this.#selection.ids.length;
    bulk.classList.toggle('table__bulk_hidden', count === 0);
    this.#root.querySelector('.table__count').textContent = `Выбрано: ${count}`;
  }

  #turn(delta) {
    const next = Math.min(Math.max(1, this.#page + delta), this.#pages);
    if (next === this.#page) return;
    emit(this.#root, EVENTS.TABLE_PAGE, { page: next });
  }
}
