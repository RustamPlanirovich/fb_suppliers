import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'alerts' });

// Проверка условий алертов и отправка уведомлений. Одно условие — один приватный метод.
export class AlertsEngine {
  #repo;
  #sender;

  constructor(repo, sender) {
    this.#repo = repo;
    this.#sender = sender;
  }

  async run({ limit = 2000 } = {}) {
    const candidates = await this.#repo.candidates(limit);
    let fired = 0;
    for (const alert of candidates) {
      const hit = this.#evaluate(alert);
      if (!hit) continue;
      await this.#notify(alert, hit);
      fired += 1;
    }
    return { checked: candidates.length, fired };
  }

  #evaluate(alert) {
    switch (alert.type) {
      case 'price_below': return this.#priceBelow(alert);
      case 'price_drop_pct': return this.#priceDrop(alert);
      case 'margin_above': return this.#marginAbove(alert);
      case 'sell_price_up': return this.#sellPriceUp(alert);
      case 'new_supplier': return this.#newSupplier(alert);
      default: return null;
    }
  }

  #priceBelow(alert) {
    const price = Number(alert.buy_min);
    if (!price || price > Number(alert.threshold)) return null;
    return { value: price, message: `Цена закупки ${price} ₽ — ниже вашего порога ${alert.threshold} ₽` };
  }

  #priceDrop(alert) {
    const trend = Number(alert.trend_7d_pct ?? 0);
    if (trend > -Number(alert.threshold)) return null;
    return { value: trend, message: `Цена закупки упала на ${Math.abs(trend)}% за неделю` };
  }

  #marginAbove(alert) {
    const margin = Number(alert.margin_pct ?? 0);
    if (margin < Number(alert.threshold)) return null;
    return { value: margin, message: `Потенциальная маржа ${margin}% — выше порога ${alert.threshold}%` };
  }

  #sellPriceUp(alert) {
    const sell = Number(alert.sell_avg ?? 0);
    if (!sell || sell < Number(alert.threshold)) return null;
    return { value: sell, message: `Средняя цена продажи выросла до ${sell} ₽` };
  }

  #newSupplier(alert) {
    const count = Number(alert.suppliers_count ?? 0);
    if (count < Number(alert.threshold)) return null;
    return { value: count, message: `По позиции уже ${count} поставщиков` };
  }

  async #notify(alert, hit) {
    const title = `${alert.product_name ?? 'Позиция'} — ${alert.variant_name ?? ''}`.trim();
    const text = `🔔 ${title}\n${hit.message}`;
    try {
      await this.#sender.sendText(alert.telegram_id, text);
      await this.#repo.registerHit(alert.id, hit.value, hit.message);
    } catch (err) {
      log.warn('Не удалось отправить алерт', { alertId: alert.id, err: err.message });
    }
  }
}
