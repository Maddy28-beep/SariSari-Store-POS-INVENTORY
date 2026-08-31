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

  const byProduct = {};
  items.forEach((item) => {
    if (!byProduct[item.productName]) byProduct[item.productName] = { productName: item.productName, qty: 0, revenue: 0 };
    byProduct[item.productName].qty += item.quantity;
    byProduct[item.productName].revenue += item.lineTotal;
  });
  const bestSellers = Object.values(byProduct).sort((a, b) => b.qty - a.qty).slice(0, 10);

  const byPayment = {};
  sales.forEach((s) => {
    if (!byPayment[s.paymentMethod]) byPayment[s.paymentMethod] = { method: s.paymentMethod, count: 0, total: 0 };
    byPayment[s.paymentMethod].count += 1;
    byPayment[s.paymentMethod].total += s.total;
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
