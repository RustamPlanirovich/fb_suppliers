import { BOT_ACTION, BOT_EVENT_EXTRA, BOT_LIMITS } from '../../../utils/constants.js';
import { supplierLink } from '../../../utils/supplier.link.js';
import { categoriesKeyboard, supplierKeyboard, pagerKeyboard } from '../keyboards.js';
import { formatSupplierRow } from '../formatters.js';

// Навигация по категориям: раздел → подраздел → список поставщиков с листанием.
export class CatalogHandler {
  #categories;
  #favorites;
  #access;
  #search;

  constructor({ categories, favorites, access, search }) {
    this.#categories = categories;
    this.#favorites = favorites;
    this.#access = access;
    this.#search = search;
  }

  register(bot) {
    bot.action(new RegExp(`^${BOT_ACTION.CATEGORY}:(\\d+)$`), (ctx) =>
      this.open(ctx, Number(ctx.match[1])));
    bot.action(new RegExp(`^${BOT_ACTION.CATEGORY_PAGE}:(\\d+):(\\d+)$`), (ctx) =>
      this.#suppliers(ctx, Number(ctx.match[1]), Number(ctx.match[2])));
    bot.action(new RegExp(`^${BOT_ACTION.VARIANT_SUPPLIERS}:(\\d+):(\\d+)$`), (ctx) =>
      this.variantSuppliers(ctx, Number(ctx.match[1]), Number(ctx.match[2])));
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
    return null;
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
    await this.sendSuppliers(ctx, rows);
    if (pages > 1) {
      await ctx.reply('Листать список:',
        pagerKeyboard(BOT_ACTION.VARIANT_SUPPLIERS, variantId, page, pages));
    }
    return null;
  }

  // Общий вывод карточек: используется и категориями, и выдачей после поиска.
  async sendSuppliers(ctx, suppliers) {
    const { user, access } = ctx.state;
    const canOpen = this.#access.can(access, 'show_contacts');
    for (const supplier of suppliers) {
      const isFavorite = await this.#favorites.has(user.id, Number(supplier.id));
      await ctx.reply(formatSupplierRow(supplier), supplierKeyboard({
        supplier, link: supplierLink(supplier), isFavorite, canOpen,
      }));
    }
  }
}
