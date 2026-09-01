import { collection, collectionGroup, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAllProducts, stockStatus } from './products';

function rangeFor(period) {
  const now = new Date();
  let start;
  if (period === 'weekly') {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
  } else if (period === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(now) };
}

export async function getSalesInRange(period) {
  const { start } = rangeFor(period);
  const q = query(
    collection(db, 'sales'),
    where('status', '==', 'completed'),
    where('createdAt', '>=', start),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSaleItemsInRange(period) {
  const { start } = rangeFor(period);
  const q = query(collectionGroup(db, 'items'), where('createdAt', '>=', start));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, saleId: d.ref.parent.parent.id, ...d.data() }));
}

export function summarizeReports(sales, items) {
  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
  const transactionCount = sales.length;

  // `items` comes from a collectionGroup query that has no idea whether its parent
  // sale later got voided, so cross-reference against the (already status-filtered)
  // completed sales list before counting anything toward best-sellers.
  const completedSaleIds = new Set(sales.map((s) => s.id));
  const validItems = items.filter((item) => completedSaleIds.has(item.saleId));

  const byProduct = {};
  validItems.forEach((item) => {
    if (!byProduct[item.productName]) byProduct[item.productName] = { productName: item.productName, qty: 0, revenue: 0 };
    byProduct[item.productName].qty += item.quantity;
    byProduct[item.productName].revenue += item.lineTotal;
  });
  const bestSellers = Object.values(byProduct).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // Break split sales into their cash/gcash legs so the summary reflects actual money
  // collected per method rather than lumping a split sale's whole total into one bucket.
  const byPayment = {};
  sales.forEach((s) => {
    const legs = s.payments || [{ method: s.paymentMethod, amount: s.total }];
    legs.forEach((leg) => {
      if (!byPayment[leg.method]) byPayment[leg.method] = { method: leg.method, count: 0, total: 0 };
      byPayment[leg.method].count += 1;
      byPayment[leg.method].total += leg.amount;
    });
  });

  const byCashier = {};
  sales.forEach((s) => {
    if (!byCashier[s.cashierId]) byCashier[s.cashierId] = { cashierId: s.cashierId, count: 0, total: 0 };
    byCashier[s.cashierId].count += 1;
    byCashier[s.cashierId].total += s.total;
  });

  return {
    totalSales,
    transactionCount,
    bestSellers,
    paymentSummary: Object.values(byPayment),
    cashierSummary: Object.values(byCashier),
  };
}

export async function getStockReport() {
  const products = await getAllProducts();
  const active = products.filter((p) => p.status === 'active');

  const lowStock = active.filter((p) => stockStatus(p) === 'low');
  const outOfStock = active.filter((p) => stockStatus(p) === 'out');

  const costValue = active.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);
  const retailValue = active.reduce((sum, p) => sum + p.currentStock * p.sellingPrice, 0);

  return { lowStock, outOfStock, costValue, retailValue };
}
