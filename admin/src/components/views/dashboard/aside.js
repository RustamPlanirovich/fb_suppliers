import { el } from '../../../utils/dom.js';
import { money, num, pct } from '../../../utils/format.js';

// Правая колонка дашборда: ключевые показатели и доли товаров.
export class DashboardAside {
  #view;

  constructor(view) {
    this.#view = view;
  }

  render(data, shares) {
    const box = el('div', 'app__view');
    box.append(
      this.#view.stat('Всего поставщиков', num(data.suppliers.total),
        { text: `${num(data.suppliers.new)} новых за 30 дней`, direction: 'up' }),
      this.#view.stat('Требуют проверки', num(data.suppliers.needs_check),
        data.suppliers.needs_check ? { text: 'разобрать в очереди', direction: 'down' } : 'очередь пуста',
        data.suppliers.needs_check ? 'danger' : ''),
      this.#view.stat('Связок с ROI ≥ 20%', num(data.catalog.opportunities),
        `из ${num(data.catalog.offers)} предложений`, 'success'),
      this.#view.stat('Пользователей бота', num(data.users.total),
        { text: `${num(data.users.active_users)} активных`, direction: 'up' }),
      this.#view.stat('Доход за 30 дней', money(data.revenue.amount),
        `${num(data.revenue.payments)} оплат`),
      this.#shares(shares),
    );
    return box;
  }

  // Доли товаров по числу предложений — как список стран в референсе.
  #shares(shares) {
    const card = this.#view.card('Доли товаров в базе');
    const body = card.querySelector('.card__body');
    body.replaceChildren(...(shares?.length
      ? shares.map((row) => this.#shareRow(row))
      : [el('p', 'empty', 'Каталог пока пуст')]));
    return card;
  }

  #shareRow(row) {
    const line = el('div', 'card__header');
    line.append(el('span', null, row.name), el('span', 'page__hint', pct(row.share)));
    const box = el('div');
    box.append(line, this.#view.progress(row.share));
    return box;
  }
}
