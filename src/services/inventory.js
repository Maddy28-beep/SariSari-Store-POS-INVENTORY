import {
  collection, doc, addDoc, updateDoc, runTransaction, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const TYPES = {
  BEGINNING: 'beginning',
  STOCK_IN: 'stock_in',
  SALE: 'sale',
  RETURN: 'return',
  ADJUSTMENT: 'adjustment',
  DAMAGE: 'damage',
};

export { TYPES as InventoryTypes };

/** Records a stock movement and updates product.currentStock atomically. */
export async function moveStock(productId, type, signedQuantity, { note = null, referenceId = null, referenceType = null, userId }) {
  const productRef = doc(db, 'products', productId);

  return runTransaction(db, async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) throw new Error('Product not found');

    const current = productSnap.data().currentStock || 0;
    const stockAfter = Math.round((current + signedQuantity) * 1000) / 1000;

    tx.update(productRef, { currentStock: increment(signedQuantity), updatedAt: serverTimestamp() });

    const txRef = doc(collection(db, 'inventoryTransactions'));
    tx.set(txRef, {
      productId,
      type,
      quantity: signedQuantity,
      stockAfter,
      referenceId,
      referenceType,
      note,
      userId,
      createdAt: serverTimestamp(),
    });

    return stockAfter;
  });
}

export async function stockIn(productId, quantity, costPrice, { supplierId = null, userId }) {
  const batchRef = await addDoc(collection(db, 'productBatches'), {
    productId,
    supplierId,
    costPrice: Number(costPrice),
    quantity: Number(quantity),
    remainingQuantity: Number(quantity),
    receivedAt: serverTimestamp(),
  });

  await moveStock(productId, TYPES.STOCK_IN, Math.abs(quantity), {
    note: `Stock in (batch ${batchRef.id})`,
    referenceId: batchRef.id,
    referenceType: 'productBatch',
    userId,
  });

  await updateDoc(doc(db, 'products', productId), { costPrice: Number(costPrice) });

  return batchRef.id;
}

export async function adjustStock(productId, signedQuantity, reason, userId) {
  return moveStock(productId, TYPES.ADJUSTMENT, signedQuantity, { note: reason, userId });
}
