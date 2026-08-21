import { el } from '../../../utils/dom.js';
import { num } from '../../../utils/format.js';

// Столбчатый график по дням. Выбранный столбец подсвечен, над ним — подпись со значением.
export class Chart {
  #root = el('div', 'chart');
  #plot = el('div', 'chart__plot');
  #tip = el('div', 'chart__tip');
  #points = [];
  #active = 0;
  #unit = '';

  get element() {
    return this.#root;
  }

  render(points, { unit = '' } = {}) {
    this.#points = points;
    this.#active = points.length - 1;
    this.#root.replaceChildren(this.#tip, this.#plot);
    this.#unit = unit;
    this.#draw();
    return this.#root;
  }

  #draw() {
    const max = Math.max(1, ...this.#points.map((point) => Number(point.value)));
    this.#plot.replaceChildren(...this.#points.map((point, index) => {
      const column = el('button', 'chart__column');
      column.type = 'button';
      if (index === this.#active) column.classList.add('chart__column_active');
      const bar = el('div', 'chart__bar');
      bar.style.height = `${Math.max(4, (Number(point.value) / max) * 100)}%`;
      column.append(bar, el('div', 'chart__label', this.#day(point.day)));
      column.addEventListener('click', () => {
        this.#active = index;
        this.#draw();
      });
      return column;
    }));
    const active = this.#points[this.#active];
    this.#tip.textContent = active
      ? `${this.#day(active.day)} · ${num(active.value)} ${this.#unit}`.trim()
      : '';
  }

  #day(value) {
    return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
  }
}
