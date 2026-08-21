import { BOT_ACTION, BOT_EVENT, BOT_LIMITS, SORT_FIELDS } from '../../../utils/constants.js';
import { supplierLink } from '../../../utils/supplier.link.js';
import { formatLink, formatVariantStats } from '../formatters.js';
import { offerKeyboard, sortKeyboard, variantsKeyboard } from '../keyboards.js';

// Поиск товара и выдача предложений «где дешевле».
export class SearchHandler {
  #search;
  #catalog;
  #favorites;
  #access;
  #content;
  #categories;

  constructor({ search, catalog, favorites, access, content, categories }) {
    this.#search = search;
    this.#catalog = catalog;
    this.#favorites = favorites;
    this.#access = access;
    this.#content = content;
    this.#categories = categories;
  }

  register(bot) {
    bot.action(new RegExp(`^${BOT_ACTION.PAGE}:(\\d+)$`), (ctx) =>
      this.showOffers(ctx, Number(ctx.match[1]), SORT_FIELDS.PRICE));
    bot.action(new RegExp(`^${BOT_ACTION.SORT}:(\\d+):(\\w+)$`), (ctx) =>
      this.showOffers(ctx, Number(ctx.match[1]), ctx.match[2]));
  }

  async handleQuery(ctx, text) {
    const { user, access } = ctx.state;
    const quota = await this.#access.consumeSearch(user.id, access);
    if (!quota.allowed) {
      return ctx.reply(await this.#content.text('paywall', 'Лимит поисков на сегодня исчерпан.'));
    }
    const variants = await this.#search.searchVariants({ text, userId: user.id });
    if (!variants.length) {
      return ctx.reply(await this.#content.text('empty_results', 'Ничего не найдено.'));
    }
    if (variants.length === 1) return this.showOffers(ctx, Number(variants[0].id), SORT_FIELDS.PRICE);
    return ctx.reply('Уточните позицию:', variantsKeyboard(variants.slice(0, BOT_LIMITS.RESULTS_PER_PAGE)));
  }

  async showOffers(ctx, variantId, sort) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    const { user } = ctx.state;
    const variant = await this.#catalog.getVariant(variantId);
    const { offers } = await this.#search.offersFor(variantId, { sort });
    await this.#search.logEvent({ userId: user.id, type: BOT_EVENT.SEARCH, variantId });

    await ctx.replyWithMarkdownV2(formatVariantStats(variant), sortKeyboard(variantId));
    if (!offers.length) return ctx.reply('Активных предложений по этой позиции пока нет.');

    const canOpen = this.#access.can(ctx.state.access, 'show_contacts');
    for (const offer of offers) {
      const isFavorite = await this.#favorites.has(user.id, Number(offer.supplier_id));
      await ctx.replyWithMarkdownV2(
        formatLink(offer, variant),
        offerKeyboard({
          offerId: offer.id,
          supplierId: offer.supplier_id,
          variantId,
          isFavorite,
          link: supplierLink(offer),
          canOpen,
        }),
      );
    }
    return this.#showAllButton(ctx, variantId, offers.length);
  }

  // По позиции может быть и 50, и 200 поставщиков — предлагаем открыть полный список.
  async #showAllButton(ctx, variantId, shown) {
    const { total } = await this.#categories.suppliersByVariant(variantId, { limit: 1, offset: 0 });
    if (total <= shown) return null;
    return ctx.reply(`Всего поставщиков по позиции: ${total}`, {
      reply_markup: {
        inline_keyboard: [[{
          text: `📋 Показать всех (${total})`,
          callback_data: `${BOT_ACTION.VARIANT_SUPPLIERS}:${variantId}:1`,
        }]],
      },
    });
  }
}
