import {
  collection, doc, setDoc, updateDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDocsSafe, settleFast } from '../firebase/offline';
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
