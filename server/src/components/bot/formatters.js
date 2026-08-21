import { escapeMd } from '../../utils/text.js';

const money = (value, currency = '₽') =>
  (value == null ? '—' : `${Number(value).toLocaleString('ru-RU')} ${currency}`);

const pct = (value) => (value == null ? '—' : `${Number(value)}%`);

const COMPETITION_LABEL = { low: 'низкая', medium: 'средняя', high: 'высокая' };
const RISK_LABEL = { low: 'низкий', medium: 'средний', high: 'высокий' };

// Карточка связки: источник → товар → площадка → прибыль. Главный экран бота.
export function formatLink(offer, variant) {
  const lines = [
    `*${escapeMd(variant.product_name)} — ${escapeMd(variant.variant_name ?? variant.name)}*`,
    `Поставщик: ${escapeMd(offer.supplier_name)}`,
    `Закупка: ${escapeMd(money(offer.price))}`,
  ];
  if (offer.profit) {
    lines.push(
      `Площадка: ${escapeMd(offer.marketplace ?? '—')}`,
      `Средняя продажа: ${escapeMd(money(offer.profit.sellPrice))}`,
      `Комиссия: ${escapeMd(money(offer.profit.commission))}`,
      `Чистыми: ${escapeMd(money(offer.profit.profitPerUnit))} \\(ROI ${escapeMd(pct(offer.profit.roiPct))}\\)`,
    );
  }
  lines.push(
    `Надёжность: ${escapeMd(String(offer.score_reliability ?? '—'))} из 5`,
    `Подтверждённых покупок за 30 дней: ${escapeMd(String(offer.confirmed_deals_30d ?? 0))}`,
    `Свежесть цены: ${escapeMd(freshness(offer.price_checked_at))}`,
  );
  if (offer.is_promoted) lines.push('📌 Размещение оплачено');
  return lines.join('\n');
}

// Статистика позиции: диапазоны закупки и продажи, конкуренция, тренд.
export function formatVariantStats(variant) {
  return [
    `*${escapeMd(variant.product_name)} — ${escapeMd(variant.name)}*`,
    `Закупка: ${escapeMd(money(variant.buy_min))} – ${escapeMd(money(variant.buy_max))}`,
    `Продажа: ${escapeMd(money(variant.sell_min))} – ${escapeMd(money(variant.sell_max))}`,
    `Средняя маржа: ${escapeMd(pct(variant.margin_pct))}`,
    `Поставщиков: ${escapeMd(String(variant.suppliers_count ?? 0))}`,
    `Конкуренция: ${escapeMd(COMPETITION_LABEL[variant.competition] ?? '—')}`,
    `Тренд цены за 7 дней: ${escapeMd(pct(variant.trend_7d_pct))}`,
  ].join('\n');
}

export function formatOpportunity(link, index) {
  return [
    `${index + 1}\\. *${escapeMd(link.product_name)} — ${escapeMd(link.variant_name)}*`,
    `Купить ${escapeMd(money(link.buy_price))} → продать ${escapeMd(money(link.sell_price))}`,
    `Чистыми ${escapeMd(money(link.profit))} \\(ROI ${escapeMd(pct(link.roi_pct))}\\), риск ${escapeMd(RISK_LABEL[link.risk_level] ?? '—')}`,
  ].join('\n');
}

// Строка витрины «что выгодно» для бота.
export function formatOpportunityRow(row) {
  const competition = COMPETITION_LABEL[row.competition] ?? '—';
  return `• ${row.product_name} — ${row.variant_name}\n`
    + `  ${money(row.buy_min)} → ${money(row.sell_avg)} · чистыми ${money(row.profit)}`
    + ` · маржа ${pct(row.margin_pct)} · конкуренция ${competition}`;
}

// История цены — компактный текстовый ряд вместо графика.
export function formatSeries(series) {
  if (!series.length) return 'История цены пока не накоплена';
  return series
    .map((point) => `${new Date(point.day).toLocaleDateString('ru-RU')} — ${money(point.price_min)}`)
    .join('\n');
}

export function formatProfit(result) {
  return [
    `Закупка: ${money(result.buyPrice)} × ${result.qty}`,
    `Продажа: ${money(result.sellPrice)}`,
    `Комиссия: ${money(result.commission)}`,
    `Чистыми с единицы: ${money(result.profitPerUnit)}`,
    `Итого: ${money(result.profitTotal)}`,
    `ROI: ${pct(result.roiPct)} · Маржа: ${pct(result.marginPct)}`,
  ].join('\n');
}

export function freshness(checkedAt) {
  if (!checkedAt) return 'неизвестно';
  const hours = Math.round((Date.now() - new Date(checkedAt).getTime()) / 3_600_000);
  if (hours < 1) return 'меньше часа назад';
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.round(hours / 24)} дн назад`;
}

export { money, pct };
