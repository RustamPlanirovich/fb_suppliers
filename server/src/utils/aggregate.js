// Сводка по набору цен: минимум, среднее, медиана, максимум.
export function priceStats(prices) {
  const sorted = prices.filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const sum = sorted.reduce((total, price) => total + price, 0);
  const middle = Math.floor(sorted.length / 2);
  return {
    priceMin: sorted[0],
    priceMax: sorted.at(-1),
    priceAvg: Math.round((sum / sorted.length) * 100) / 100,
    priceMedian: sorted.length % 2
      ? sorted[middle]
      : Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100,
    count: sorted.length,
  };
}

// Отбрасывает выбросы по межквартильному размаху: одна аномальная цена не должна
// перекашивать среднюю цену продажи, на которой считается маржа.
export function withoutOutliers(prices) {
  const sorted = prices.filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
  if (sorted.length < 8) return sorted;
  const quartile = (share) => sorted[Math.floor(sorted.length * share)];
  const q1 = quartile(0.25);
  const q3 = quartile(0.75);
  const gap = (q3 - q1) * 1.5;
  return sorted.filter((price) => price >= q1 - gap && price <= q3 + gap);
}
