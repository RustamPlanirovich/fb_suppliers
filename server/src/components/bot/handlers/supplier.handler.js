import { BOT_ACTION, BOT_EVENT, BOT_STATE, MARKETPLACE_SOURCES } from '../../../utils/constants.js';
import { complaintKeyboard, REASON_LABELS } from '../keyboards.js';

// Контакты поставщика и жалобы «неактуально / проблема».
export class SupplierHandler {
  #suppliers;
  #search;
  #moderation;
  #access;
  #session;
  #content;

  constructor({ suppliers, search, moderation, access, session, content }) {
    this.#suppliers = suppliers;
    this.#search = search;
    this.#moderation = moderation;
    this.#access = access;
    this.#session = session;
    this.#content = content;
  }

  register(bot) {
    bot.action(new RegExp(`^${BOT_ACTION.CONTACTS}:(\\d+)$`), (ctx) => this.#contacts(ctx));
    bot.action(new RegExp(`^${BOT_ACTION.COMPLAIN}:(\\d+)$`), (ctx) => this.#askReason(ctx));
    bot.action(new RegExp(`^${BOT_ACTION.COMPLAIN_REASON}:(\\d+):(\\w+)$`), (ctx) => this.#createComplaint(ctx));
  }

  async #contacts(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    const supplierId = Number(ctx.match[1]);
    const { user, access } = ctx.state;
    if (!this.#access.can(access, 'show_contacts')) {
      return ctx.reply(await this.#content.text('paywall', 'Контакты доступны на платном тарифе.'));
    }
    const supplier = await this.#suppliers.getById(supplierId);

    // Карточки площадок — источник цен, а не контактов: правила площадки не обходим.
    if (MARKETPLACE_SOURCES.includes(supplier.source)) {
      return ctx.reply(
        `${supplier.name}: это продавец площадки. Сделка проводится внутри площадки — открыть: ${supplier.external_url ?? '—'}`,
      );
    }
    await this.#search.logEvent({ userId: user.id, type: BOT_EVENT.CONTACT_OPEN, supplierId });
    return ctx.reply(this.#contactsText(supplier));
  }

  #contactsText(supplier) {
    const lines = [supplier.name];
    if (supplier.telegram) lines.push(`Telegram: @${supplier.telegram}`);
    if (supplier.website) lines.push(`Сайт: ${supplier.website}`);
    if (supplier.email) lines.push(`Email: ${supplier.email}`);
    if (supplier.phone) lines.push(`Телефон: ${supplier.phone}`);
    if (lines.length === 1) lines.push('Контакты не указаны — сообщите об этом кнопкой «Проблема».');
    return lines.join('\n');
  }

  async #askReason(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    return ctx.reply('Что не так с поставщиком?', complaintKeyboard(Number(ctx.match[1])));
  }

  async #createComplaint(ctx) {
    await ctx.answerCbQuery('Спасибо, приняли').catch(() => {});
    const supplierId = Number(ctx.match[1]);
    const reason = ctx.match[2];
    const { user } = ctx.state;
    await this.#moderation.createComplaint({ supplierId, userId: user.id, reason });
    await this.#search.logEvent({ userId: user.id, type: BOT_EVENT.COMPLAINT, supplierId,
      payload: { reason } });
    await this.#session.setState(ctx.from.id, BOT_STATE.AWAIT_COMPLAINT_TEXT, { supplierId });
    return ctx.reply(
      `Причина «${REASON_LABELS[reason]}» записана. Можно добавить подробности одним сообщением или пропустить.`,
    );
  }

  // Текст-дополнение к последней жалобе приходит следующим сообщением.
  async attachComplaintText(ctx, text, payload) {
    await this.#moderation.createSubmission({
      userId: ctx.state.user.id,
      type: 'other',
      supplierId: payload.supplierId,
      payload: { comment: text },
      evidence: 'Сообщение пользователя в боте',
    });
    await this.#session.clearState(ctx.from.id);
    return ctx.reply('Спасибо, передали администраторам.');
  }
}
