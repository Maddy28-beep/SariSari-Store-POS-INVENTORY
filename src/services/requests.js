import {
  collection, doc, setDoc, updateDoc, writeBatch, increment, query, where, serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDocsSafe, getDocSafe, settleFast, commitFast } from '../firebase/offline';
import { createProduct, lookupByBarcode } from './products';
import { moveStock, stockIn, InventoryTypes } from './inventory';

/*
 * Inventory requests: a cashier can propose a new product or a stock-in, but nothing
 * touches the real inventory until an Owner/Admin approves it on the Approvals page.
 */

const col = () => collection(db, 'inventoryRequests');

function byNewest(list) {
  return list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

async function submit(kind, payload, userId) {
  const ref = doc(col());
  await settleFast(setDoc(ref, {
    kind,
    status: 'pending',
    payload,
    requestedBy: userId,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
}

export function submitProductRequest(form, unit, userId) {
  return submit('product', {
    barcode: form.barcode || null,
    name: form.name,
    categoryId: form.categoryId || null,
    unitId: form.unitId,
    unitAbbreviation: unit?.abbreviation || null,
    allowDecimal: !!unit?.allowDecimal,
    supplierId: form.supplierId || null,
    costPrice: Number(form.costPrice),
    sellingPrice: Number(form.sellingPrice),
    reorderLevel: Number(form.reorderLevel),
    initialStock: Number(form.initialStock) || 0,
  }, userId);
}

export function submitStockInRequest({ supplierId, items }, userId) {
  return submit('stock_in', {
    supplierId: supplierId || null,
    items: items.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: Number(i.quantity),
      costPrice: Number(i.costPrice),
    })),
  }, userId);
}

async function loadRequests(q) {
  const snap = await getDocsSafe(q);
  return byNewest(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })));
}

export const getPendingRequests = () => loadRequests(query(col(), where('status', '==', 'pending')));
export const getMyRequests = (userId) => loadRequests(query(col(), where('requestedBy', '==', userId)));

function markReviewed(req, status, reviewerId, note) {
  return settleFast(updateDoc(doc(db, 'inventoryRequests', req.id), {
    status,
    reviewedBy: reviewerId,
    reviewedAt: serverTimestamp(),
    reviewNote: note || null,
  }));
}

/** Applies the request to the real inventory, then marks it approved. */
export async function approveRequest(req, reviewerId) {
  if (req.status !== 'pending') throw new Error('This request was already handled.');
  const p = req.payload;

  if (req.kind === 'refund') {
    await applyRefund(p, reviewerId, req);
    return;
  }

  if (req.kind === 'discount') {
    await markReviewed(req, 'approved', reviewerId);
    return;
  }

  if (req.kind === 'product') {
    if (p.barcode && (await lookupByBarcode(p.barcode))) {
      throw new Error(`Barcode ${p.barcode} is already registered to another product. Reject this request.`);
    }
    const ref = await createProduct(p, reviewerId, { abbreviation: p.unitAbbreviation, allowDecimal: p.allowDecimal });
    if (p.initialStock > 0) {
      await moveStock(ref.id, InventoryTypes.BEGINNING, p.initialStock, {
        note: 'Initial stock (approved cashier request)', userId: reviewerId,
      });
    }
  } else {
    for (const item of p.items) {
      await stockIn(item.productId, item.quantity, item.costPrice, { supplierId: p.supplierId, userId: reviewerId });
    }
  }

  await markReviewed(req, 'approved', reviewerId);
}

export const rejectRequest = (req, reviewerId, note) => markReviewed(req, 'rejected', reviewerId, note);

/* ---------------- Partial refunds (return some items from a sale) ---------------- */

export const getRefundsForSale = async (saleId) => {
  const snap = await getDocsSafe(query(collection(db, 'refunds'), where('saleId', '==', saleId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export function submitRefundRequest({ sale, lines, reason }, userId) {
  return submit('refund', {
    saleId: sale.id,
    transactionNo: sale.transactionNo,
    reason,
    lines,
    amount: refundAmount(lines),
  }, userId);
}

export const refundAmount = (lines) => Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100;

/**
 * Puts the returned items back into stock and records the refund in one atomic batch.
 * Used directly by the owner/admin, or on approving a cashier's refund request.
 */
export async function applyRefund(payload, reviewerId, request = null) {
  const sale = await getDocSafe(doc(db, 'sales', payload.saleId));
  if (!sale.exists() || sale.data().status !== 'completed') throw new Error('Only completed sales can be refunded.');

  // Don't refund more than was sold, counting refunds already approved.
  const soldSnap = await getDocsSafe(collection(db, 'sales', payload.saleId, 'items'));
  const sold = {};
  soldSnap.docs.forEach((d) => { sold[d.data().productId] = (sold[d.data().productId] || 0) + d.data().quantity; });
  (await getRefundsForSale(payload.saleId)).forEach((r) => {
    r.lines.forEach((l) => { sold[l.productId] = (sold[l.productId] || 0) - l.quantity; });
  });
  payload.lines.forEach((l) => {
    if (l.quantity <= 0 || l.quantity > (sold[l.productId] || 0) + 1e-9) {
      throw new Error(`Can't refund ${l.quantity} of "${l.productName}" - only ${Math.max(0, sold[l.productId] || 0)} left to refund on this sale.`);
    }
  });

  const batch = writeBatch(db);
  const refundRef = doc(collection(db, 'refunds'));
  batch.set(refundRef, {
    saleId: payload.saleId,
    transactionNo: payload.transactionNo,
    lines: payload.lines,
    amount: payload.amount,
    reason: payload.reason,
    approvedBy: reviewerId,
    createdAt: serverTimestamp(),
  });
  payload.lines.forEach((l) => {
    batch.update(doc(db, 'products', l.productId), { currentStock: increment(l.quantity), updatedAt: serverTimestamp() });
    batch.set(doc(collection(db, 'inventoryTransactions')), {
      productId: l.productId,
      type: InventoryTypes.RETURN,
      quantity: l.quantity,
      referenceId: payload.saleId,
      referenceType: 'refund',
      note: `Refund on ${payload.transactionNo}`,
      userId: reviewerId,
      createdAt: serverTimestamp(),
    });
  });
  if (request) {
    batch.update(doc(db, 'inventoryRequests', request.id), {
      status: 'approved', reviewedBy: reviewerId, reviewedAt: serverTimestamp(), reviewNote: null,
    });
  }
  await commitFast(batch);
}

/* ---------------- Cashier discounts (owner/admin must approve) ---------------- */

export const submitDiscountRequest = ({ amount, subtotal, reason }, userId) =>
  submit('discount', { amount: Math.round(Number(amount) * 100) / 100, subtotal, reason: reason || null }, userId);

/** Live status of one request, so the POS can unlock the discount the moment it's approved. */
export function watchRequest(id, onChange) {
  return onSnapshot(doc(db, 'inventoryRequests', id), (snap) => onChange(snap.exists() ? snap.data() : null), () => {});
}
