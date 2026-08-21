// Форматирование значений для таблиц и карточек.
export const money = (value, currency = '₽') =>
  (value === null || value === undefined || value === '' ? '—'
    : `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency}`);

export const pct = (value) =>
  (value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`);

export const num = (value) =>
  (value === null || value === undefined ? '—' : Number(value).toLocaleString('ru-RU'));

export const date = (value) =>
  (value ? new Date(value).toLocaleDateString('ru-RU') : '—');

export const dateTime = (value) =>
  (value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export const label = (dictionary, key, fallback = '—') => dictionary[key] ?? key ?? fallback;

// «3 дня назад» — для колонки свежести цены.
export function ago(value) {
  if (!value) return '—';
  const hours = Math.round((Date.now() - new Date(value).getTime()) / 3_600_000);
  if (hours < 1) return 'только что';
  if (hours < 24) return `${hours} ч`;
  return `${Math.round(hours / 24)} дн`;
}
