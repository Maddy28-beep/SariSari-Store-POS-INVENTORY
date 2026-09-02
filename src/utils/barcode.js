/**
 * Generates EAN-13 barcodes in GS1's reserved "restricted circulation" range
 * (prefix 20–29) — the standard way to mint in-store barcodes for loose or
 * repacked items (sugar, salt, feeds, ...) that guarantees no collision with
 * a real manufacturer's barcode.
 */

function ean13CheckDigit(digits12) {
  const sum = digits12
    .split('')
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function generateInternalBarcode() {
  const prefix = '20';
  const middle = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  const payload = prefix + middle;
  return payload + ean13CheckDigit(payload);
}

export function isInternalBarcode(barcode) {
  return typeof barcode === 'string' && barcode.length === 13 && barcode.startsWith('2');
}
