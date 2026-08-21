// Единая арифметика прибыли: используется калькулятором бота, сканером связок и админкой.
import { COMPETITION_BOUNDS, RISK_BOUNDS } from './constants.js';

const round2 = (value) => Math.round(Number(value) * 100) / 100;

// Чистая прибыль с одной единицы: выручка минус комиссия площадки, фикс. сбор и закупка.
export function calcProfit({ buyPrice, sellPrice, commissionPct = 0, payoutFee = 0, qty = 1 }) {
  const buy = Number(buyPrice) || 0;
  const sell = Number(sellPrice) || 0;
  const commission = round2((sell * (Number(commissionPct) || 0)) / 100);
  const fee = Number(payoutFee) || 0;
  const netPerUnit = round2(sell - commission - fee - buy);
  return {
    buyPrice: round2(buy),
    sellPrice: round2(sell),
    commission,
    payoutFee: round2(fee),
    qty: Math.max(1, Number(qty) || 1),
    profitPerUnit: netPerUnit,
    profitTotal: round2(netPerUnit * Math.max(1, Number(qty) || 1)),
    roiPct: buy > 0 ? round2((netPerUnit / buy) * 100) : 0,
    marginPct: sell > 0 ? round2((netPerUnit / sell) * 100) : 0,
  };
}

export function competitionLevel(sellersCount) {
  const count = Number(sellersCount) || 0;
  if (count <= COMPETITION_BOUNDS.LOW) return 'low';
  if (count <= COMPETITION_BOUNDS.MEDIUM) return 'medium';
  return 'high';
}

// Риск связки: свежесть цены + надёжность поставщика + подтверждённые сделки.
export function riskLevel({ priceAgeHours, reliability, confirmedDeals }) {
  let points = 0;
  if ((Number(priceAgeHours) || 0) > RISK_BOUNDS.PRICE_AGE_HOURS) points += 1;
  if ((Number(reliability) || 0) < RISK_BOUNDS.MIN_RELIABILITY) points += 1;
  if ((Number(confirmedDeals) || 0) < RISK_BOUNDS.MIN_DEALS) points += 1;
  if (points >= 2) return 'high';
  return points === 1 ? 'medium' : 'low';
}

// Изменение цены в процентах: положительное — рост.
export function changePct(from, to) {
  const base = Number(from) || 0;
  if (!base) return 0;
  return round2(((Number(to) - base) / base) * 100);
}

export { round2 };
