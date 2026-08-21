import { BOT_ACTION, BOT_EVENT_EXTRA } from '../../../utils/constants.js';
import { calcProfit } from '../../../utils/profit.js';
import { formatProfit, formatSeries } from '../formatters.js';

// Инструменты реселлера: история цены, калькулятор, watchlist, алерты.
export class ToolsHandler {
  #offers;
  #catalog;
  #favorites;
  #alerts;
  #access;
  #search;
  #content;

  constructor({ offers, catalog, favorites, alerts, access, search, content }) {
    this.#offers = offers;
    this.#catalog = catalog;
    this.#favorites = favorites;
    this.#alerts = alerts;
    this.#access = access;
    this.#search = search;
    this.#content = content;
  }

  register(bot) {
    bot.action(/^hist:(\d+)$/, (ctx) => this.#history(ctx));
    bot.action(/^calc:(\d+)$/, (ctx) => this.#calc(ctx));
    bot.action(/^watch:(\d+)$/, (ctx) => this.#watch(ctx));
    bot.action(/^alert:(\d+)$/, (ctx) => this.#alertHint(ctx));
    bot.action(new RegExp(`^${BOT_ACTION.FAVORITE}:(\\d+)$`), (ctx) => this.#favorite(ctx, true));
    bot.action(new RegExp(`^${BOT_ACTION.UNFAVORITE}:(\\d+)$`), (ctx) => this.#favorite(ctx, false));
  }

  async #history(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    const { access, user } = ctx.state;
    if (!this.#access.can(access, 'price_history')) {
      return ctx.reply(await this.#content.text('paywall', 'История цены доступна на платном тарифе.'));
    }
    const offer = await this.#offers.getById(Number(ctx.match[1]));
    const series = await this.#offers.variantSeries(offer.variant_id, 30);
    await this.#search.logEvent({ userId: user.id, type: BOT_EVENT_EXTRA.PRICE_HISTORY,
      variantId: offer.variant_id });
    return ctx.reply(`История закупочной цены за 30 дней:\n${formatSeries(series)}`);
  }

  // Быстрый расчёт по текущему предложению: комиссия площадки подставляется автоматически.
  async #calc(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    const offer = await this.#offers.getById(Number(ctx.match[1]));
    const { offers: enriched } = await this.#search.offersFor(offer.variant_id, { limit: 50 });
    const current = enriched.find((row) => Number(row.id) === Number(offer.id)) ?? offer;
    const money = current.profit ?? calcProfit({ buyPrice: offer.price, sellPrice: offer.price });
    await this.#search.logEvent({ userId: ctx.state.user.id, type: BOT_EVENT_EXTRA.CALC,
      variantId: offer.variant_id });
    return ctx.reply(
      `${formatProfit(money)}\n\nСвой расчёт: /calc закупка продажа количество`,
    );
  }

  // Ручной калькулятор: /calc 650 990 10
  async manualCalc(ctx, args) {
    const [buy, sell, qty] = args.map(Number);
    if (!Number.isFinite(buy) || !Number.isFinite(sell)) {
      return ctx.reply('Формат: /calc закупка продажа [количество]. Например: /calc 650 990 10');
    }
    return ctx.reply(formatProfit(calcProfit({ buyPrice: buy, sellPrice: sell, qty: qty || 1 })));
  }

  async #watch(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    const { user, access } = ctx.state;
    const limit = this.#access.limit(access, 'watchlist_limit', 0);
    if (limit && (await this.#favorites.watchCount(user.id)) >= limit) {
      return ctx.reply(`Лимит отслеживаемых позиций на вашем тарифе: ${limit}`);
    }
    await this.#favorites.addWatch(user.id, Number(ctx.match[1]));
    await this.#search.logEvent({ userId: user.id, type: BOT_EVENT_EXTRA.WATCH_ADD,
      variantId: Number(ctx.match[1]) });
    return ctx.reply('Позиция добавлена в отслеживаемые. Список: /watchlist');
  }

  async #alertHint(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    return ctx.reply(
      `Создать уведомление по этой позиции:\n`
      + `/alert ${ctx.match[1]} price_below 500 — сообщить, если цена ниже 500 ₽\n`
      + `/alert ${ctx.match[1]} margin_above 25 — если маржа выше 25%`,
    );
  }

  async createAlert(ctx, args) {
    const [variantId, type, threshold] = args;
    const { user, access } = ctx.state;
    const limit = this.#access.limit(access, 'alerts_limit', 0);
    if (limit && (await this.#alerts.countForUser(user.id)) >= limit) {
      return ctx.reply(`Лимит алертов на вашем тарифе: ${limit}`);
    }
    await this.#alerts.create({
      userId: user.id, variantId: Number(variantId), type, threshold: Number(threshold),
    });
    return ctx.reply('Уведомление создано. Список: /alerts');
  }

  async #favorite(ctx, add) {
    await ctx.answerCbQuery(add ? 'Добавлено' : 'Удалено').catch(() => {});
    const supplierId = Number(ctx.match[1]);
    const { user, access } = ctx.state;
    if (add) {
      const limit = this.#access.limit(access, 'favorites_limit', 0);
      if (limit && (await this.#favorites.count(user.id)) >= limit) {
        return ctx.reply(`Лимит избранного на вашем тарифе: ${limit}`);
      }
      await this.#favorites.add(user.id, supplierId);
    } else {
      await this.#favorites.remove(user.id, supplierId);
    }
    return null;
  }
}
