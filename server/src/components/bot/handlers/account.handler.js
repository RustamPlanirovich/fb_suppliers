import { BOT_EVENT_EXTRA } from '../../../utils/constants.js';
import { calcProfit } from '../../../utils/profit.js';
import { formatOpportunity, formatOpportunityRow, money, pct } from '../formatters.js';

const MARKET_LIMIT = 10;

const MARKET_TITLES = {
  sell: '📈 Выгодно продавать: маржа есть, конкурентов мало',
  buy: '🛒 Выгодно покупать: цена закупки снижается',
  rising: '🔥 Растёт спрос',
  falling: '📉 Цена упала за неделю',
};

// Личный кабинет: избранное, watchlist, алерты, позиции реселлера, тарифы, возможности.
export class AccountHandler {
  #favorites;
  #positions;
  #alerts;
  #arbitrage;
  #analytics;
  #plans;
  #access;
  #search;
  #content;

  constructor({ favorites, positions, alerts, arbitrage, analytics, plans, access, search, content }) {
    this.#favorites = favorites;
    this.#positions = positions;
    this.#alerts = alerts;
    this.#arbitrage = arbitrage;
    this.#analytics = analytics;
    this.#plans = plans;
    this.#access = access;
    this.#search = search;
    this.#content = content;
  }

  async favorites(ctx) {
    const rows = await this.#favorites.list(ctx.state.user.id, 50);
    if (!rows.length) return ctx.reply('В избранном пока пусто.');
    return ctx.reply(rows.map((row) =>
      `• ${row.name} — надёжность ${row.score_reliability ?? '—'}, предложений ${row.offers_count}`)
      .join('\n'));
  }

  async watchlist(ctx) {
    const rows = await this.#favorites.watchList(ctx.state.user.id, 50);
    if (!rows.length) return ctx.reply('Отслеживаемых позиций пока нет.');
    return ctx.reply(rows.map((row) =>
      `• ${row.product_name} — ${row.variant_name}: закупка ${money(row.buy_min)}, маржа ${pct(row.margin_pct)}`)
      .join('\n'));
  }

  async alerts(ctx) {
    const rows = await this.#alerts.listForUser(ctx.state.user.id);
    if (!rows.length) return ctx.reply('Уведомлений пока нет. Создать: /alert <id> <тип> <порог>');
    return ctx.reply(rows.map((row) =>
      `#${row.id} ${row.product_name ?? ''} ${row.variant_name ?? ''} — ${row.type} ${row.threshold}`)
      .join('\n'));
  }

  // Сканер возможностей — сердце платного тарифа.
  async opportunities(ctx) {
    const { access, user } = ctx.state;
    if (!this.#access.can(access, 'arbitrage')) {
      return ctx.reply(await this.#content.text('paywall', 'Сканер связок доступен на тарифе Reseller.'));
    }
    const links = await this.#arbitrage.opportunities({ roiMin: 20, limit: 10 });
    await this.#search.logEvent({ userId: user.id, type: BOT_EVENT_EXTRA.ARBITRAGE_VIEW });
    if (!links.length) return ctx.reply('Сейчас подходящих связок нет — загляните позже.');
    return ctx.replyWithMarkdownV2(links.map(formatOpportunity).join('\n\n'));
  }

  // Аналитика рынка: что выгодно продавать и где цена падает. Платная возможность тарифа.
  async market(ctx, preset = 'sell') {
    const { access, user } = ctx.state;
    if (!this.#access.can(access, 'market_analytics')) {
      return ctx.reply(await this.#content.text('paywall',
        'Аналитика рынка доступна на тарифе Reseller.'));
    }
    const rows = await this.#analytics.list(preset, MARKET_LIMIT);
    await this.#search.logEvent({ userId: user.id, type: BOT_EVENT_EXTRA.MARKET_VIEW,
      payload: { preset } });
    if (!rows.length) return ctx.reply('Подходящих позиций сейчас нет — загляните позже.');
    return ctx.reply([MARKET_TITLES[preset], '', ...rows.map(formatOpportunityRow)].join('\n'));
  }

  async positions(ctx) {
    const { access, user } = ctx.state;
    if (!this.#access.can(access, 'crm')) {
      return ctx.reply(await this.#content.text('paywall', 'Кабинет реселлера доступен на тарифе Reseller.'));
    }
    const [rows, summary] = await Promise.all([
      this.#positions.list(user.id, 30),
      this.#positions.summary(user.id),
    ]);
    const header = `Продано позиций: ${summary.positions}, вложено ${money(summary.invested)}, прибыль ${money(summary.profit)}`;
    if (!rows.length) return ctx.reply(`${header}\n\nДобавить: /pos Название закупка продажа количество`);
    const list = rows.map((row) => {
      const result = calcProfit({
        buyPrice: row.buy_price, sellPrice: row.sell_price,
        commissionPct: row.commission_pct, qty: row.qty,
      });
      return `• ${row.title} — ${money(row.buy_price)} → ${money(row.sell_price)} × ${row.qty} = ${money(result.profitTotal)}`;
    });
    return ctx.reply([header, '', ...list].join('\n'));
  }

  async addPosition(ctx, args) {
    const qty = Number(args.at(-1));
    const sell = Number(args.at(-2));
    const buy = Number(args.at(-3));
    const title = args.slice(0, -3).join(' ');
    if (!title || ![buy, sell, qty].every(Number.isFinite)) {
      return ctx.reply('Формат: /pos Название закупка продажа количество');
    }
    await this.#positions.create(ctx.state.user.id, { title, buyPrice: buy, sellPrice: sell, qty });
    return ctx.reply('Позиция добавлена. Список: /positions');
  }

  async plans(ctx) {
    const plans = await this.#plans.all(true);
    const current = ctx.state.access;
    const list = plans.map((plan) => {
      const features = Object.entries(plan.features ?? {})
        .filter(([, value]) => value === true)
        .map(([key]) => key)
        .join(', ');
      return `*${plan.name}* — ${money(plan.price)} / ${plan.days} дн\n${features || 'базовые возможности'}`;
    });
    return ctx.reply(
      [`Ваш тариф: ${current.planName ?? current.planCode}`, '', ...list].join('\n\n'),
      { parse_mode: 'Markdown' },
    );
  }
}
