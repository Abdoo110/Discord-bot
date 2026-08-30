const numberWords = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100,
};

const PRICES = Object.freeze({ 1: 4999000, 2: 8999000 });

function parseQuantity(input) {
  if (!input) return 0;
  const s = input.toString().toLowerCase().trim();
  const num = parseInt(s, 10);
  if (!isNaN(num)) return num;
  if (numberWords[s]) return numberWords[s];
  const parts = s.split(/[\s-]+/);
  let total = 0;
  for (const p of parts) { if (numberWords[p]) total += numberWords[p]; }
  return total || NaN;
}

function calculatePrice(shulkerType, quantity) {
  const qty = parseQuantity(quantity);
  if (isNaN(qty) || qty <= 0) return { total: 0, formatted: '—' };
  let unitPrice = 0;
  const type = shulkerType.toString().toLowerCase().trim();
  if (type === '1' || type === 'one') unitPrice = PRICES[1];
  else if (type === '2' || type === 'two') unitPrice = PRICES[2];
  else return { total: 0, formatted: '— (unknown type)' };
  const total = unitPrice * qty;
  const formatted = formatPrice(total);
  return { total, formatted, unitPrice, quantity: qty };
}

function formatCompact(value, suffix) {
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return rounded.toFixed(3).replace(/\.?0+$/, '') + suffix;
}

function formatPrice(n) {
  if (n >= 1000000000) return formatCompact(n / 1000000000, 'B');
  if (n >= 1000000) return formatCompact(n / 1000000, 'M');
  if (n >= 1000) return (Math.round((n / 1000 + Number.EPSILON) * 10) / 10).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

module.exports = { parseQuantity, calculatePrice, formatPrice, PRICES };
