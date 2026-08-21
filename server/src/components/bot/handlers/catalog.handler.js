import { BOT_ACTION, BOT_EVENT_EXTRA, BOT_LIMITS } from '../../../utils/constants.js';
import { supplierLink } from '../../../utils/supplier.link.js';
import {
  categoriesKeyboard, supplierKeyboard, pagerKeyboard, offerLinkKeyboard, exportKeyboard,
} from '../keyboards.js';
import { formatSupplierRow, formatOfferRow } from '../formatters.js';

// Навигация по категориям: раздел → подраздел → список поставщиков с листанием.
export class CatalogHandler {
  #categories;
  #favorites;
  #access;
  #search;
  #exporter;

  constructor({ categories, favorites, access, search, exporter }) {
    this.#categories = categories;
    this.#favorites = favorites;
    this.#access = access;
    this.#search = search;
    this.#exporter = exporter;
  }

  register(bot) {
    bot.action(new RegExp(`^${BOT_ACTION.CATEGORY}:(\\d+)$`), (ctx) =>
      this.open(ctx, Number(ctx.match[1])));
    bot.action(new RegExp(`^${BOT_ACTION.CATEGORY_PAGE}:(\\d+):(\\d+)$`), (ctx) =>
      this.#suppliers(ctx, Number(ctx.match[1]), Number(ctx.match[2])));
    bot.action(new RegExp(`^${BOT_ACTION.VARIANT_SUPPLIERS}:(\\d+):(\\d+)$`), (ctx) =>
      this.variantSuppliers(ctx, Number(ctx.match[1]), Number(ctx.match[2])));
    bot.action(new RegExp(`^${BOT_ACTION.SUPPLIER_OFFERS}:(\\d+):(\\d+):(\\d+)$`), (ctx) =>
      this.#supplierOffers(ctx, Number(ctx.match[1]), Number(ctx.match[2]), Number(ctx.match[3])));
    bot.action(new RegExp(`^${BOT_ACTION.EXPORT}:(\\w+):(\\d+)$`), (ctx) =>
      this.#export(ctx, ctx.match[1], Number(ctx.match[2])));
    bot.action(/^noop$/, (ctx) => ctx.answerCbQuery().catch(() => {}));
  }

  // id = 0 — корень дерева.
  async open(ctx, categoryId = 0) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    const category = categoryId ? await this.#categories.findById(categoryId) : null;
    const children = await this.#categories.children(categoryId || null);

    if (!children.length && category) return this.#suppliers(ctx, categoryId, 1);
    if (!children.length) {
      return ctx.reply('Категории пока не заведены — воспользуйтесь поиском по названию товара.');
    }
    await this.#search.logEvent({ userId: ctx.state.user.id, type: BOT_EVENT_EXTRA.CATEGORY_VIEW,
      payload: { categoryId } });

    const title = category
      ? `${category.name}: выберите подкатегорию`
      : 'Выберите категорию:';
    const keyboard = categoriesKeyboard(children, category);
    // У категории могут быть и подкатегории, и свои поставщики — даём попасть в оба места.
    if (category?.id) {
      keyboard.reply_markup.inline_keyboard.unshift([{
        text: `📋 Все поставщики раздела (${await this.#count(categoryId)})`,
        callback_data: `${BOT_ACTION.CATEGORY_PAGE}:${categoryId}:1`,
      }]);
    }
    return ctx.reply(title, keyboard);
  }

  async #count(categoryId) {
    const { total } = await this.#categories.suppliers(categoryId, { limit: 1, offset: 0 });
    return total;
  }

  async #suppliers(ctx, categoryId, page) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    const limit = BOT_LIMITS.SUPPLIERS_PER_PAGE;
    const { rows, total } = await this.#categories.suppliers(categoryId,
      { limit, offset: (page - 1) * limit });
    if (!total) return ctx.reply('В этом разделе поставщиков пока нет.');

    const category = await this.#categories.findById(categoryId);
    const pages = Math.max(1, Math.ceil(total / limit));
    await ctx.reply(`${category?.name ?? 'Раздел'}: ${total} поставщиков (стр. ${page} из ${pages})`);
    await this.sendSuppliers(ctx, rows);
    if (pages > 1) {
      await ctx.reply('Листать список:',
        pagerKeyboard(BOT_ACTION.CATEGORY_PAGE, categoryId, page, pages));
    }
    return ctx.reply('Разобрать список в таблице:', exportKeyboard('category', categoryId));
  }

  // Полный список поставщиков по позиции — с листанием, от самой низкой цены.
  async variantSuppliers(ctx, variantId, page) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    const limit = BOT_LIMITS.SUPPLIERS_PER_PAGE;
    const { rows, total } = await this.#categories.suppliersByVariant(variantId,
      { limit, offset: (page - 1) * limit });
    if (!total) return ctx.reply('Поставщиков по этой позиции не найдено.');
    const pages = Math.max(1, Math.ceil(total / limit));
    await ctx.reply(`Поставщиков: ${total} (стр. ${page} из ${pages})`);
    await this.sendSuppliers(ctx, rows, variantId);
    if (pages > 1) {
      await ctx.reply('Листать список:',
        pagerKeyboard(BOT_ACTION.VARIANT_SUPPLIERS, variantId, page, pages));
    }
    return ctx.reply('Разобрать список в таблице:', exportKeyboard('variant', variantId));
  }

  // Что есть у поставщика: список его позиций, каждая ведёт на свой лот.
  async #supplierOffers(ctx, supplierId, variantId, page) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    const limit = BOT_LIMITS.SUPPLIER_OFFERS_PER_PAGE;
    const { rows, total } = await this.#categories.supplierOffers(supplierId, {
      variantId: variantId || null, limit, offset: (page - 1) * limit,
    });
    if (!total) return ctx.reply('У поставщика сейчас нет активных позиций.');

    await this.#search.logEvent({ userId: ctx.state.user.id, type: BOT_EVENT_EXTRA.SUPPLIER_OFFERS,
      supplierId, variantId: variantId || null });
    const pages = Math.max(1, Math.ceil(total / limit));
    await ctx.reply(`Позиции поставщика: ${total} (стр. ${page} из ${pages})`);
    for (const offer of rows) {
      await ctx.reply(formatOfferRow(offer), offerLinkKeyboard(offer));
    }
    if (pages > 1) {
      await ctx.reply('Листать позиции:', {
        reply_markup: {
          inline_keyboard: [[
            ...(page > 1 ? [{ text: '⬅️', callback_data: `${BOT_ACTION.SUPPLIER_OFFERS}:${supplierId}:${variantId}:${page - 1}` }] : []),
            { text: `${page} / ${pages}`, callback_data: 'noop' },
            ...(page < pages ? [{ text: '➡️', callback_data: `${BOT_ACTION.SUPPLIER_OFFERS}:${supplierId}:${variantId}:${page + 1}` }] : []),
          ]],
        },
      });
    }
    return null;
  }

  // Выгрузка показанного списка: удобнее разбирать в таблице, чем листать в переписке.
  async #export(ctx, kind, id) {
    await ctx.answerCbQuery().catch(() => {});
    const { access, user } = ctx.state;
    if (!this.#access.can(access, 'export')) {
      return ctx.reply('Выгрузка в файл доступна на платном тарифе. Тарифы: /plans');
    }
    const file = await this.#exporter.build(kind, id);
    if (!file) return ctx.reply('Выгружать нечего.');
    await this.#search.logEvent({ userId: user.id, type: BOT_EVENT_EXTRA.EXPORT,
      payload: { kind, id } });
    return ctx.replyWithDocument({ source: file.buffer, filename: file.filename });
  }

  // Общий вывод карточек: используется и категориями, и выдачей после поиска.
  async sendSuppliers(ctx, suppliers, variantId = 0) {
    const { user, access } = ctx.state;
    const canOpen = this.#access.can(access, 'show_contacts');
    for (const supplier of suppliers) {
      const isFavorite = await this.#favorites.has(user.id, Number(supplier.id));
      await ctx.reply(formatSupplierRow(supplier), supplierKeyboard({
        supplier, link: supplierLink(supplier), isFavorite, canOpen, variantId,
      }));
    }
  }
}
