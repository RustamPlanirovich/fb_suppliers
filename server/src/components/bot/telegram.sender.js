import { AppError } from '../../utils/errors.js';
import { telegraf } from './telegram.client.js';

// Отправка сообщений наружу: используется рассылками и движком алертов.
class TelegramSender {
  async sendText(chatId, text, extra = {}) {
    return this.#api().sendMessage(chatId, text, { disable_web_page_preview: true, ...extra });
  }

  async send(chatId, message) {
    const markup = this.#markup(message.buttons);
    if (message.media_url) {
      return this.#api().sendPhoto(chatId, message.media_url, { caption: message.body, ...markup });
    }
    return this.sendText(chatId, message.body, markup);
  }

  #markup(buttons) {
    const list = Array.isArray(buttons) ? buttons : [];
    if (!list.length) return {};
    return {
      reply_markup: {
        inline_keyboard: list.map((button) => [{ text: button.text, url: button.url }]),
      },
    };
  }

  #api() {
    if (!telegraf) throw new AppError('Телеграм-бот не сконфигурирован', { status: 503, code: 'BOT_DISABLED' });
    return telegraf.telegram;
  }
}

export const telegramSender = new TelegramSender();
