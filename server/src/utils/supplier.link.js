// Прямая ссылка на поставщика: по ней пользователь попадает к нему одним касанием.
// Порядок: Telegram → площадка → сайт. Ничего нет — ссылки не будет.
// В контексте конкретного предложения ведём на сам лот: профиль продавца площадки
// не отвечает на вопрос «где именно этот товар».
export function offerLink(offer) {
  return offer.url ?? supplierLink(offer);
}

export function supplierLink(supplier) {
  if (supplier.telegram) return `https://t.me/${String(supplier.telegram).replace(/^@/, '')}`;
  if (supplier.external_url) return supplier.external_url;
  if (supplier.offer_url) return supplier.offer_url;
  if (supplier.website) {
    return /^https?:\/\//.test(supplier.website) ? supplier.website : `https://${supplier.website}`;
  }
  return null;
}
