import { el } from '../../../utils/dom.js';
import { dateTime, money, pct } from '../../../utils/format.js';

const RISK_MODIFIER = { low: 'success', medium: 'warning', high: 'danger' };

const SOURCE_LABELS = {
  admin: 'администратор', parser: 'площадка', user: 'пользователь', import: 'импорт',
};

// Витрина лучших связок и лента последних изменений цен.
export class DashboardFeed {
  #view;

  constructor(view) {
    this.#view = view;
  }

  links(links) {
    const card = this.#view.card('Лучшие связки', [
      { title: 'Все связки', onClick: () => { location.hash = 'arbitrage'; } },
    ]);
    const grid = el('div', 'card__grid');
    grid.replaceChildren(...(links?.length
      ? links.map((link) => this.#linkCard(link))
      : [el('p', 'empty', 'Связок пока нет — загрузите цены и запустите пересчёт')]));
    card.querySelector('.card__body').append(grid);
    return card;
  }

  #linkCard(link) {
    const box = el('div', 'card card_nested');
    box.append(
      el('p', 'card__title', `${link.product_name} · ${link.variant_name}`),
      el('p', 'page__hint', `${money(link.buy_price)} → ${money(link.sell_price)}`),
    );
    const foot = el('div', 'card__header');
    foot.append(
      el('span', null, `${money(link.profit)} чистыми`),
      this.#view.badge(pct(link.roi_pct), RISK_MODIFIER[link.risk_level] ?? ''),
    );
    box.append(this.#view.progress(link.roi_pct, RISK_MODIFIER[link.risk_level]), foot);
    return box;
  }

  recent(rows) {
    const card = this.#view.card('Последние изменения цен', [
      { title: 'Все предложения', onClick: () => { location.hash = 'offers'; } },
    ]);
    const feed = el('div', 'feed');
    feed.replaceChildren(...(rows?.length
      ? rows.map((row) => this.#recentRow(row))
      : [el('p', 'empty', 'Изменений пока не было')]));
    card.querySelector('.card__body').append(feed);
    return card;
  }

  #recentRow(row) {
    const line = el('div', 'feed__row');
    line.append(
      this.#cell('Товар', `${row.product_name} · ${row.variant_name}`),
      this.#cell('Поставщик', row.supplier_name),
      this.#cell('Было', row.prev_price ? money(row.prev_price) : '—'),
      this.#cell('Стало', money(row.price)),
      this.#cell('Источник', SOURCE_LABELS[row.source] ?? row.source),
      this.#cell('Когда', dateTime(row.created_at)),
    );
    return line;
  }

  #cell(label, value) {
    const box = el('div', 'feed__cell');
    const text = el('p', 'feed__value', value ?? '—');
    text.title = value ?? '';
    box.append(el('span', 'page__label', label), text);
    return box;
  }
}
