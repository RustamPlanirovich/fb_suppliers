import { logger } from '../../utils/logger.js';
import { BOT_LIMITS, BOT_STATE, BOT_EVENT } from '../../utils/constants.js';
import { telegraf } from './telegram.client.js';
import { botDeps, botSession } from './bot.container.js';
import { mainMenu } from './keyboards.js';
import { SearchHandler } from './handlers/search.handler.js';
import { SupplierHandler } from './handlers/supplier.handler.js';
import { ToolsHandler } from './handlers/tools.handler.js';
import { AccountHandler } from './handlers/account.handler.js';
import { SubmitHandler } from './handlers/submit.handler.js';

const log = logger.child({ component: 'bot' });

// Сборка бота: команды, кнопки, свободный текст. Логика живёт в хендлерах.
export class Bot {
  #bot;
  #search;
  #supplier;
  #tools;
  #account;
  #submit;

  constructor(instance = telegraf) {
    this.#bot = instance;
    this.#search = new SearchHandler(botDeps);
    this.#supplier = new SupplierHandler(botDeps);
    this.#tools = new ToolsHandler(botDeps);
    this.#account = new AccountHandler(botDeps);
    this.#submit = new SubmitHandler(botDeps);
  }

  // launch() в Telegraf резолвится только при остановке бота, поэтому его нельзя ждать:
  // иначе всё, что идёт после запуска бота (планировщик), никогда не выполнится.
  async launch() {
    if (!this.#bot) return null;
    this.#bot.use(botSession.middleware());
    this.#registerCommands();
    this.#registerActions();
    this.#registerText();
    this.#bot.catch((err, ctx) =>
      log.error('Ошибка обработчика бота', { err: err.message, update: ctx.updateType }));

    this.#bot.launch().catch((err) => log.error('Бот остановлен с ошибкой', { err: err.message }));
    const profile = await this.#bot.telegram.getMe();
    log.info('Телеграм-бот запущен', { username: profile.username });
    return this.#bot;
  }

  stop(signal) {
    this.#bot?.stop(signal);
  }

  #registerCommands() {
    const bot = this.#bot;
    bot.start(async (ctx) => {
      await botDeps.search.logEvent({ userId: ctx.state.user.id, type: BOT_EVENT.START });
      return ctx.reply(await botDeps.content.text('start', 'Напишите название товара.'), mainMenu());
    });
    bot.help(async (ctx) => ctx.reply(await botDeps.content.text('help', 'Отправьте название товара.')));
    bot.command('favorites', (ctx) => this.#account.favorites(ctx));
    bot.command('watchlist', (ctx) => this.#account.watchlist(ctx));
    bot.command('alerts', (ctx) => this.#account.alerts(ctx));
    bot.command('plans', (ctx) => this.#account.plans(ctx));
    bot.command('positions', (ctx) => this.#account.positions(ctx));
    bot.command('deals', (ctx) => this.#account.opportunities(ctx));
    bot.command('market', (ctx) => this.#account.market(ctx, this.#args(ctx)[0] ?? 'sell'));
    bot.command('calc', (ctx) => this.#tools.manualCalc(ctx, this.#args(ctx)));
    bot.command('alert', (ctx) => this.#tools.createAlert(ctx, this.#args(ctx)));
    bot.command('pos', (ctx) => this.#account.addPosition(ctx, this.#args(ctx)));
    bot.command('add', (ctx) => this.#submit.addSupplier(ctx, this.#args(ctx)));
    bot.command('price', (ctx) => this.#submit.priceUpdate(ctx, this.#args(ctx)));
    bot.command('find', (ctx) => this.#submit.request(ctx, this.#args(ctx)));
  }

  #registerActions() {
    this.#search.register(this.#bot);
    this.#supplier.register(this.#bot);
    this.#tools.register(this.#bot);
  }

  // Свободный текст: либо продолжение диалога, либо поисковый запрос.
  #registerText() {
    this.#bot.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return null;

      const menu = await this.#handleMenu(ctx, text);
      if (menu) return menu;

      const { state, payload } = await botSession.getState(ctx.from.id);
      if (state === BOT_STATE.AWAIT_COMPLAINT_TEXT) {
        return this.#supplier.attachComplaintText(ctx, text, payload);
      }
      if (text.length < BOT_LIMITS.MIN_QUERY_LENGTH) {
        return ctx.reply('Слишком короткий запрос — введите минимум 2 символа.');
      }
      return this.#search.handleQuery(ctx, text.slice(0, BOT_LIMITS.MAX_QUERY_LENGTH));
    });
  }

  #handleMenu(ctx, text) {
    const menu = {
      '🔎 Найти товар': () => ctx.reply('Введите название товара.'),
      '🔥 Возможности': () => this.#account.opportunities(ctx),
      '📈 Что выгодно': () => this.#account.market(ctx),
      '⭐ Избранное': () => this.#account.favorites(ctx),
      '📋 Мои позиции': () => this.#account.positions(ctx),
      '🔔 Мои алерты': () => this.#account.alerts(ctx),
      '💼 Тарифы': () => this.#account.plans(ctx),
    };
    return menu[text]?.() ?? null;
  }

  #args(ctx) {
    return ctx.message.text.split(/\s+/).slice(1);
  }
}
