// Иконки разделов: строятся через DOM API (createElementNS), без innerHTML.
// Значение — набор путей SVG в системе координат 24×24.
const PATHS = {
  dashboard: ['M4 4h7v7H4z', 'M13 4h7v4h-7z', 'M13 10h7v10h-7z', 'M4 13h7v7H4z'],
  suppliers: ['M4 20v-1a5 5 0 015-5h1', 'M17 20v-1a3 3 0 00-3-3', 'M9.5 9.5a3.5 3.5 0 107 0 3.5 3.5 0 10-7 0'],
  catalog: ['M4 7l8-4 8 4-8 4-8-4z', 'M4 12l8 4 8-4', 'M4 17l8 4 8-4'],
  offers: ['M4 7h16v12H4z', 'M8 7V5a4 4 0 018 0v2', 'M9 12h6'],
  arbitrage: ['M4 18l5-6 4 4 7-9', 'M15 7h5v5'],
  flags: ['M12 4l8 14H4z', 'M12 10v4', 'M12 16.5v.5'],
  moderation: ['M4 6h16v11H8l-4 3z', 'M9 11h6', 'M9 8h3'],
  users: ['M4 20v-2a4 4 0 014-4h4a4 4 0 014 4v2', 'M7 8.5a3 3 0 106 0 3 3 0 10-6 0', 'M17 12a3 3 0 100-6'],
  plans: ['M4 8h16v11H4z', 'M4 8l3-4h10l3 4', 'M9 12h6'],
  promotions: ['M5 10l10-5v14L5 14z', 'M5 10H4v4h1', 'M8 15v3'],
  content: ['M5 4h14v16H5z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  broadcasts: ['M4 10l14-6v16L4 14z', 'M4 10v4', 'M9 15v4'],
  market: ['M4 19h16', 'M7 15v-4', 'M12 15V7', 'M17 15v-6'],
  sources: ['M12 3a9 9 0 100 18 9 9 0 100-18', 'M3.5 12h17', 'M12 3a14 14 0 000 18', 'M12 3a14 14 0 010 18'],
  io: ['M12 3v10', 'M8.5 9.5L12 13l3.5-3.5', 'M4 15v4h16v-4'],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function icon(name, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of PATHS[name] ?? PATHS.dashboard) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

// Инициалы для кружка профиля.
export function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
