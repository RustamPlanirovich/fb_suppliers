import { el } from '../../../utils/dom.js';
import { money, num } from '../../../utils/format.js';

// Предпросмотр разбивки раздела на варианты: что именно попадёт в базу.
export class PreviewTable {
  render(groups) {
    const scroll = el('div', 'table__scroll');
    const table = el('table', 'table__grid');
    const head = el('tr', 'table__head');
    for (const title of ['Вариант', 'Предложений', 'Продавцов', 'Мин', 'Медиана', 'Средняя', 'Макс']) {
      head.append(el('th', 'table__th', title));
    }
    table.append(head);
    for (const group of groups) {
      const row = el('tr', 'table__row');
      row.append(
        el('td', 'table__td', group.name),
        el('td', 'table__td', num(group.offers)),
        el('td', 'table__td', num(group.sellers)),
        el('td', 'table__td', money(group.priceMin)),
        el('td', 'table__td', money(group.priceMedian)),
        el('td', 'table__td', money(group.priceAvg)),
        el('td', 'table__td', money(group.priceMax)),
      );
      table.append(row);
    }
    scroll.append(table);
    return scroll;
  }
}
