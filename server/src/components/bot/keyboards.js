import { Markup } from 'telegraf';
import { BOT_ACTION, COMPLAINT_REASONS } from '../../utils/constants.js';

const REASON_LABELS = {
  closed: 'Закрылся',
  no_answer: 'Не отвечает',
  wrong_contacts: 'Неверные контакты',
  scam: 'Обман',
  price: 'Цена не та',
  out_of_stock: 'Товар закончился',
  other: 'Другое',
};

export const mainMenu = () => Markup.keyboard([
  ['🔎 Найти товар', '🔥 Возможности'],
  ['📈 Что выгодно'],
  ['⭐ Избранное', '📋 Мои позиции'],
  ['🔔 Мои алерты', '💼 Тарифы'],
]).resize();

// Кнопки под карточкой предложения.
export const offerKeyboard = ({ offerId, supplierId, variantId, isFavorite }) => Markup.inlineKeyboard([
  [
    Markup.button.callback('📇 Контакты', `${BOT_ACTION.CONTACTS}:${supplierId}`),
    Markup.button.callback(
      isFavorite ? '💔 Из избранного' : '⭐ В избранное',
      `${isFavorite ? BOT_ACTION.UNFAVORITE : BOT_ACTION.FAVORITE}:${supplierId}`,
    ),
  ],
  [
    Markup.button.callback('📉 История цены', `hist:${offerId}`),
    Markup.button.callback('🧮 Калькулятор', `calc:${offerId}`),
  ],
  [
    Markup.button.callback('👁 Отслеживать', `watch:${variantId}`),
    Markup.button.callback('🔔 Алерт', `alert:${variantId}`),
  ],
  [Markup.button.callback('⚠️ Неактуально / проблема', `${BOT_ACTION.COMPLAIN}:${supplierId}`)],
]);

export const sortKeyboard = (variantId) => Markup.inlineKeyboard([
  [
    Markup.button.callback('По цене', `${BOT_ACTION.SORT}:${variantId}:price`),
    Markup.button.callback('По надёжности', `${BOT_ACTION.SORT}:${variantId}:reliability`),
  ],
  [
    Markup.button.callback('По сделкам', `${BOT_ACTION.SORT}:${variantId}:sales`),
    Markup.button.callback('По отзывам', `${BOT_ACTION.SORT}:${variantId}:reviews`),
  ],
]);

export const variantsKeyboard = (variants) => Markup.inlineKeyboard(
  variants.map((variant) => [
    Markup.button.callback(
      `${variant.product_name} — ${variant.name}`.slice(0, 60),
      `${BOT_ACTION.PAGE}:${variant.id}`,
    ),
  ]),
);

export const complaintKeyboard = (supplierId) => Markup.inlineKeyboard(
  COMPLAINT_REASONS.map((reason) => [
    Markup.button.callback(REASON_LABELS[reason], `${BOT_ACTION.COMPLAIN_REASON}:${supplierId}:${reason}`),
  ]),
);

export { REASON_LABELS };
