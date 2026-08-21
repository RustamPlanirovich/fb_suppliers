import { api } from '../../utils/api.js';
import { el } from '../../utils/dom.js';
import { num } from '../../utils/format.js';
import { View } from './view.base.js';
import { Chart } from './dashboard/chart.js';
import { DashboardAside } from './dashboard/aside.js';
import { DashboardFeed } from './dashboard/feed.js';

// Дашборд: витрина связок, график активности и лента цен слева, сводка справа.
export class DashboardView extends View {
  #chart = new Chart();
  #aside;
  #feed;

  constructor(deps) {
    super(deps);
    this.root.classList.add('app__view_split');
    this.#aside = new DashboardAside(this);
    this.#feed = new DashboardFeed(this);
  }

  async mount() {
    const [dashboard, overview] = await Promise.all([
      this.guard(() => api.get('/analytics/dashboard', { period: 'month' })),
      this.guard(() => api.get('/analytics/overview', { metric: 'searches', days: 10 })),
    ]);
    if (!dashboard || !overview) return;

    const main = el('div', 'app__view');
    main.append(
      this.#feed.links(overview.links),
      this.#activity(dashboard, overview.series),
      this.#feed.recent(overview.recent),
    );
    this.root.replaceChildren(main, this.#aside.render(dashboard, overview.shares));
  }

  // График поисков за 10 дней + сводка активности бота.
  #activity(dashboard, series) {
    const card = this.card('Активность за 10 дней');
    const body = card.querySelector('.card__body');
    body.append(this.#chart.render(series, { unit: 'поисков' }));

    const grid = el('div', 'card__grid');
    grid.append(
      this.stat('Поисков за 30 дней', num(dashboard.activity.searches)),
      this.stat('Без результатов', num(dashboard.activity.empty_searches),
        'чего не хватает в базе', dashboard.activity.empty_searches ? 'danger' : ''),
      this.stat('Открытий контактов', num(dashboard.activity.contact_opens)),
      this.stat('Жалоб', num(dashboard.activity.complaints),
        '', dashboard.activity.complaints ? 'danger' : ''),
    );
    body.append(grid);
    return card;
  }
}
