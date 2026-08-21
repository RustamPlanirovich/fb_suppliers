// Приведение запроса и названия к общему виду, чтобы «YouTube», «youtube» и «ютуб»
// сравнивались друг с другом.
const RU_TO_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

// Раскладка: набрал «ютуб» латиницей вслепую — получилось «.ne,».
const LAYOUT = {
  q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з',
  a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л', l: 'д',
  z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь',
};

export function normalizeQuery(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Пары букв, которыми одно и то же слово записывают по-разному:
// capcut/капкут, roblox/роблокс, spotify/спотифай.
const FOLD = [
  [/ph/g, 'f'],
  [/ck/g, 'c'],
  [/k/g, 'c'],
  [/x/g, 'cs'],
  [/w/g, 'v'],
];

// Ключ сравнения: только латинские буквы и цифры, кириллица транслитерирована,
// взаимозаменяемые буквы сведены к одному написанию.
export function searchKey(value) {
  const latin = normalizeQuery(value)
    .split('')
    .map((char) => RU_TO_LAT[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]/g, '');
  return FOLD.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), latin);
}

// Скелет слова: первая буква и согласные. Гласные различаются между языками сильнее всего
// («youtube» и «ютуб»), поэтому без них написания сходятся.
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

export function skeletonKey(value) {
  const key = searchKey(value);
  if (key.length < 2) return '';
  const skeleton = key
    .split('')
    .filter((char, index) => index === 0 || !VOWELS.has(char))
    .join('');
  return skeleton.length >= 2 ? skeleton : '';
}

// Обратная раскладка — на случай ввода не в том языке.
export function fromLayout(value) {
  const converted = normalizeQuery(value).split('').map((char) => LAYOUT[char] ?? char).join('');
  return converted === normalizeQuery(value) ? null : converted;
}

// Автоматические синонимы названия: сам текст, без пробелов и знаков, по словам.
// Языковые пары вроде «youtube ↔ ютуб» машинально не выводятся — их добавляет администратор.
export function autoAliases(name) {
  const normalized = normalizeQuery(name);
  if (!normalized) return [];
  const words = normalized.split(' ').filter((word) => word.length > 2);
  const variants = new Set([normalized, normalized.replace(/[^a-zа-я0-9]/g, ''), ...words]);
  return [...variants].filter(Boolean).map((alias) => ({
    alias,
    aliasNorm: alias,
    aliasKey: searchKey(alias),
    aliasSkel: skeletonKey(alias),
  })).filter((item) => item.aliasKey.length >= 2);
}

export function toAlias(text) {
  const normalized = normalizeQuery(text);
  return {
    alias: normalized,
    aliasNorm: normalized,
    aliasKey: searchKey(normalized),
    aliasSkel: skeletonKey(normalized),
  };
}
