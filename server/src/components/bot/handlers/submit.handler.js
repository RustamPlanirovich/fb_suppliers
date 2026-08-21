import { BOT_EVENT_EXTRA } from '../../../utils/constants.js';

// Пользовательские заявки: предложить поставщика, сообщить цену, попросить найти товар.
export class SubmitHandler {
  #moderation;
  #search;

  constructor({ moderation, search }) {
    this.#moderation = moderation;
    this.#search = search;
  }

  async addSupplier(ctx, args) {
    const text = args.join(' ').trim();
    if (text.length < 3) {
      return ctx.reply('Формат: /add Название поставщика, контакт, что продаёт');
    }
    await this.#submit(ctx, 'new_supplier', { name: text.split(',')[0].trim(), raw: text });
    return ctx.reply('Спасибо! Заявка ушла на модерацию.');
  }

  async priceUpdate(ctx, args) {
    const [offerId, price] = args;
    if (!Number.isFinite(Number(offerId)) || !Number.isFinite(Number(price))) {
      return ctx.reply('Формат: /price <id предложения> <новая цена>');
    }
    await this.#submit(ctx, 'price_update', { price: Number(price) }, Number(offerId));
    return ctx.reply('Спасибо! Цену проверит администратор.');
  }

  async request(ctx, args) {
    const text = args.join(' ').trim();
    if (text.length < 3) return ctx.reply('Формат: /find Нужен товар X до 400 ₽, объём 30 шт');
    await this.#submit(ctx, 'supplier_request', { request: text });
    return ctx.reply('Заявка принята. Если найдём подходящих поставщиков — напишем.');
  }

  async #submit(ctx, type, payload, offerId = null) {
    await this.#moderation.createSubmission({
      userId: ctx.state.user.id, type, payload, offerId,
      evidence: 'Сообщение пользователя в боте',
    });
    await this.#search.logEvent({ userId: ctx.state.user.id, type: BOT_EVENT_EXTRA.SUBMISSION,
      payload: { kind: type } });
  }
}
