const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .split('')
    .map((char) => TRANSLIT[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Нормализация поискового запроса: для аналитики и ключа кэша.
export function normalizeQuery(value) {
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

// Телефон в вид, пригодный для сравнения дублей: только цифры.
export function normalizePhone(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits || null;
}

// @user, https://t.me/user, t.me/user → user
export function normalizeTelegram(value) {
  if (!value) return null;
  const match = String(value).trim().match(/(?:t\.me\/|@)?([A-Za-z0-9_]{3,64})\/?$/);
  return match ? match[1].toLowerCase() : null;
}

export function normalizeDomain(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '') || null;
}

// Экранирование для Telegram MarkdownV2.
export function escapeMd(value) {
  return String(value ?? '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (char) => `\\${char}`);
}
