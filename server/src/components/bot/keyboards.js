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
  ['📂 Категории', '🔎 Найти товар'],
  ['🔥 Возможности', '📈 Что выгодно'],
  ['⭐ Избранное', '📋 Мои позиции'],
  ['🔔 Мои алерты', '💼 Тарифы'],
]).resize();

// Кнопки под карточкой предложения.
export const offerKeyboard = ({ offerId, supplierId, variantId, isFavorite, link, canOpen }) => Markup.inlineKeyboard([
  [Markup.button.callback('🛒 Что ещё есть у поставщика',
    `${BOT_ACTION.SUPPLIER_OFFERS}:${supplierId}:${variantId}:1`)],
  [
    link && canOpen
      ? Markup.button.url('➡️ Открыть этот товар', link)
      : Markup.button.callback('📇 Контакты', `${BOT_ACTION.CONTACTS}:${supplierId}`),
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

// Список категорий: по кнопке на категорию + счётчик поставщиков в ветке.
export const categoriesKeyboard = (categories, parent) => {
  const rows = categories.map((category) => [Markup.button.callback(
    `${category.name} · ${category.suppliers_count}`,
    `${BOT_ACTION.CATEGORY}:${category.id}`,
  )]);
  if (parent?.id) {
    rows.push([Markup.button.callback('⬅️ Назад',
      `${BOT_ACTION.CATEGORY}:${parent.parent_id ?? 0}`)]);
  }
  return Markup.inlineKeyboard(rows);
};

// Карточка поставщика в списке. Главное действие — показать, что у него есть:
// профиль продавца площадки не отвечает на вопрос «а что именно он продаёт».
export const supplierKeyboard = ({ supplier, link, isFavorite, canOpen, variantId = 0 }) => {
  const rows = [[Markup.button.callback('🛒 Что у него есть',
    `${BOT_ACTION.SUPPLIER_OFFERS}:${supplier.id}:${variantId}:1`)]];
  if (link && canOpen) rows.push([Markup.button.url('👤 Профиль поставщика', link)]);
  else if (!canOpen) rows.push([Markup.button.callback('📇 Контакты', `${BOT_ACTION.CONTACTS}:${supplier.id}`)]);
  rows.push([
    Markup.button.callback(isFavorite ? '💔 Из избранного' : '⭐ В избранное',
      `${isFavorite ? BOT_ACTION.UNFAVORITE : BOT_ACTION.FAVORITE}:${supplier.id}`),
    Markup.button.callback('⚠️ Проблема', `${BOT_ACTION.COMPLAIN}:${supplier.id}`),
  ]);
  return Markup.inlineKeyboard(rows);
};

// Позиция поставщика: кнопка ведёт прямо на этот лот, а не в профиль.
export const offerLinkKeyboard = (offer) => (offer.url
  ? Markup.inlineKeyboard([[Markup.button.url('➡️ Открыть этот товар', offer.url)]])
  : undefined);

// Выгрузка показанного списка в файл.
export const exportKeyboard = (kind, id) => Markup.inlineKeyboard([
  [Markup.button.callback('📄 Выгрузить в CSV', `${BOT_ACTION.EXPORT}:${kind}:${id}`)],
]);

// Листание длинного списка: «показано N из M».
export const pagerKeyboard = (prefix, id, page, pages) => {
  const buttons = [];
  if (page > 1) buttons.push(Markup.button.callback('⬅️', `${prefix}:${id}:${page - 1}`));
  buttons.push(Markup.button.callback(`${page} / ${pages}`, 'noop'));
  if (page < pages) buttons.push(Markup.button.callback('➡️', `${prefix}:${id}:${page + 1}`));
  return Markup.inlineKeyboard([buttons]);
};

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
