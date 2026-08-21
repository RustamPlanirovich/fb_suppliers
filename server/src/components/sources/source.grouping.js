// Группировка предложений раздела в варианты товара.
// Первый способ — фильтры площадки (data-f-*): «Family · 12 месяцев».
// Если у раздела фильтров нет, применяются правила по названию, заданные администратором.
export class OfferGrouping {
  group(offers, { variantAttrs = [], titleRules = [] } = {}) {
    const groups = new Map();
    for (const offer of offers) {
      const name = this.#variantName(offer, variantAttrs, titleRules);
      if (!groups.has(name)) groups.set(name, { name, offers: [] });
      groups.get(name).offers.push(offer);
    }
    return [...groups.values()].sort((a, b) => b.offers.length - a.offers.length);
  }

  #variantName(offer, attrs, rules) {
    const byAttrs = attrs
      .map((key) => offer.attributes[key])
      .filter(Boolean)
      .map((value) => this.#capitalize(value));
    if (byAttrs.length) return byAttrs.join(' · ');

    const byTitle = this.#matchRule(offer.title, rules);
    return byTitle ?? (rules.length ? 'Прочее' : 'Базовый');
  }

  // Правило: { name, contains }. Побеждает первое подошедшее — порядок задаёт администратор.
  #matchRule(title, rules) {
    const haystack = String(title ?? '').toLowerCase();
    for (const rule of rules) {
      const needles = String(rule.contains ?? '')
        .toLowerCase()
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean);
      if (needles.length && needles.some((needle) => haystack.includes(needle))) return rule.name;
    }
    return null;
  }

  // Один продавец может держать несколько предложений в одном варианте:
  // в базу попадает самое дешёвое — именно оно интересно покупателю.
  cheapestBySeller(offers) {
    const best = new Map();
    for (const offer of offers) {
      if (!offer.sellerId) continue;
      const current = best.get(offer.sellerId);
      if (!current || offer.price < current.price) best.set(offer.sellerId, offer);
    }
    return [...best.values()];
  }

  #capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
