import {
  collection, doc, writeBatch, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDocSafe, commitFast } from '../firebase/offline';

const TYPES = {
  BEGINNING: 'beginning',
  STOCK_IN: 'stock_in',
  SALE: 'sale',
  RETURN: 'return',
  ADJUSTMENT: 'adjustment',
  DAMAGE: 'damage',
};

export { TYPES as InventoryTypes };

function stageStockMove(batch, productId, type, signedQuantity, currentStock, { note = null, referenceId = null, referenceType = null, userId, extraProductFields = {} }) {
  const stockAfter = Math.round((currentStock + signedQuantity) * 1000) / 1000;

  batch.update(doc(db, 'products', productId), {
    currentStock: increment(signedQuantity),
    updatedAt: serverTimestamp(),
    ...extraProductFields,
  });
  batch.set(doc(collection(db, 'inventoryTransactions')), {
    productId, type, quantity: signedQuantity, stockAfter, referenceId, referenceType, note, userId,
    createdAt: serverTimestamp(),
  });
  return stockAfter;
}

async function currentStockOf(productId) {
  const snap = await getDocSafe(doc(db, 'products', productId));
  if (!snap.exists()) throw new Error('Product not found');
  return snap.data().currentStock || 0;
}

/** Records a stock movement and updates product.currentStock together (works offline). */
export async function moveStock(productId, type, signedQuantity, opts) {
  const current = await currentStockOf(productId);
  const batch = writeBatch(db);
  const stockAfter = stageStockMove(batch, productId, type, signedQuantity, current, opts);
  await commitFast(batch);
  return stockAfter;
}

export async function stockIn(productId, quantity, costPrice, { supplierId = null, userId }) {
  const current = await currentStockOf(productId);
  const batch = writeBatch(db);

  const batchRef = doc(collection(db, 'productBatches'));
  batch.set(batchRef, {
    productId,
    supplierId,
    costPrice: Number(costPrice),
    quantity: Number(quantity),
    remainingQuantity: Number(quantity),
    receivedAt: serverTimestamp(),
  });

  stageStockMove(batch, productId, TYPES.STOCK_IN, Math.abs(quantity), current, {
    note: `Stock in (batch ${batchRef.id})`,
    referenceId: batchRef.id,
    referenceType: 'productBatch',
    userId,
    extraProductFields: { costPrice: Number(costPrice) },
  });

  await commitFast(batch);
  return batchRef.id;
}

export async function adjustStock(productId, signedQuantity, reason, userId) {
  return moveStock(productId, TYPES.ADJUSTMENT, signedQuantity, { note: reason, userId });
}
