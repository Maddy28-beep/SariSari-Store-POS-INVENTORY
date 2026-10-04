import {
  collection, doc, writeBatch, serverTimestamp, query, where, increment,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { InventoryTypes } from './inventory';
import { getDocSafe, getDocsSafe, commitFast } from '../firebase/offline';

/** Cashier (or anyone) flags a completed sale for void — takes effect only once an Owner/Admin approves it. */
export async function requestVoid(saleId, reason, userId) {
  const saleRef = doc(db, 'sales', saleId);

  {
    const tx = writeBatch(db);
    const saleSnap = await getDocSafe(saleRef);
    if (!saleSnap.exists()) throw new Error('Sale not found.');
    const sale = saleSnap.data();

    if (sale.status !== 'completed') throw new Error('Only completed sales can be voided.');
    if (sale.voidStatus === 'pending') throw new Error('A void request is already pending for this sale.');

    tx.update(saleRef, {
      voidStatus: 'pending',
      voidRequestedBy: userId,
      voidRequestedAt: serverTimestamp(),
      voidReason: reason,
    });
    await commitFast(tx);
  }
}

/** Owner/Admin approves a pending void: restores stock for every line item and marks the sale voided. */
export async function approveVoid(saleId, reviewerId) {
  const saleRef = doc(db, 'sales', saleId);
  const itemsSnap = await getDocsSafe(collection(db, 'sales', saleId, 'items'));
  const items = itemsSnap.docs.map((d) => d.data());

  {
    const tx = writeBatch(db);
    const saleSnap = await getDocSafe(saleRef);
    if (!saleSnap.exists()) throw new Error('Sale not found.');
    if (saleSnap.data().voidStatus !== 'pending') throw new Error('This sale has no pending void request.');

    const productRefs = items.map((item) => doc(db, 'products', item.productId));
    const productSnaps = await Promise.all(productRefs.map((ref) => getDocSafe(ref)));

    tx.update(saleRef, {
      status: 'voided',
      voidStatus: 'approved',
      voidReviewedBy: reviewerId,
      voidReviewedAt: serverTimestamp(),
    });

    items.forEach((item, idx) => {
      if (!productSnaps[idx].exists()) return;

      tx.update(productRefs[idx], { currentStock: increment(item.quantity), updatedAt: serverTimestamp() });

      const invRef = doc(collection(db, 'inventoryTransactions'));
      tx.set(invRef, {
        productId: item.productId,
        type: InventoryTypes.RETURN,
        quantity: item.quantity,
        referenceId: saleId,
        referenceType: 'void',
        note: 'Stock restored from voided sale',
        userId: reviewerId,
        createdAt: serverTimestamp(),
      });
    });
    await commitFast(tx);
  }
}

/** Owner/Admin rejects a pending void: the sale stays completed, nothing about stock changes. */
export async function rejectVoid(saleId, reviewerId, note) {
  const saleRef = doc(db, 'sales', saleId);

  {
    const tx = writeBatch(db);
    const saleSnap = await getDocSafe(saleRef);
    if (!saleSnap.exists()) throw new Error('Sale not found.');
    if (saleSnap.data().voidStatus !== 'pending') throw new Error('This sale has no pending void request.');

    tx.update(saleRef, {
      voidStatus: 'rejected',
      voidReviewedBy: reviewerId,
      voidReviewedAt: serverTimestamp(),
      voidReviewNote: note || null,
    });
    await commitFast(tx);
  }
}

export async function getPendingVoidRequests() {
  const q = query(collection(db, 'sales'), where('voidStatus', '==', 'pending'));
  const snap = await getDocsSafe(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
