// Подпись пагинации: одна формулировка на все списки.
export function normalizePagingLabel({ page, pages, total }) {
  return `Стр. ${page} из ${pages} · всего ${total}`;
}
