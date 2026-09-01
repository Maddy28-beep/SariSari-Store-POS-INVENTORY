import {
  collection, doc, getDoc, runTransaction, serverTimestamp, query, where,
  orderBy, limit as fbLimit, getDocs, Timestamp, increment,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { InventoryTypes } from './inventory';

async function generateTransactionNo() {
  const today = new Date();
  const ymd = today.toISOString().slice(0, 10).replace(/-/g, '');
  const startOfDay = Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

  const q = query(collection(db, 'sales'), where('createdAt', '>=', startOfDay));
  const snap = await getDocs(q);
  const seq = String(snap.size + 1).padStart(4, '0');

  return `${ymd}-${seq}`;
}

/**
 * items: [{ productId, quantity }]
 * Validates stock, deducts inventory, and records the sale atomically.
 */
export async function checkout({ items, discount = 0, paymentMethod, amountTendered, paymentReference, cashierId }) {
  if (!items?.length) throw new Error('Cart is empty.');

  const transactionNo = await generateTransactionNo();

  return runTransaction(db, async (tx) => {
    const productRefs = items.map((i) => doc(db, 'products', i.productId));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    let subtotal = 0;
    const lines = [];

    productSnaps.forEach((snap, idx) => {
      if (!snap.exists()) throw new Error('A product in the cart no longer exists.');
      const product = snap.data();
      const quantity = Number(items[idx].quantity);

      if (product.status !== 'active') {
        throw new Error(`"${product.name}" is not available.`);
      }
      if (product.currentStock < quantity) {
        throw new Error(`Only ${product.currentStock} available for "${product.name}".`);
      }

      const lineTotal = Math.round(product.sellingPrice * quantity * 100) / 100;
      subtotal += lineTotal;

      lines.push({
        ref: productRefs[idx],
        productId: items[idx].productId,
        productName: product.name,
        quantity,
        unitPrice: product.sellingPrice,
        lineTotal,
      });
    });

    const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

    let tendered = amountTendered;
    let change = 0;
    if (paymentMethod === 'cash') {
      if (tendered < total) throw new Error('Amount tendered is less than the total.');
      change = Math.round((tendered - total) * 100) / 100;
    } else {
      tendered = amountTendered ?? total;
    }

    const saleRef = doc(collection(db, 'sales'));
    tx.set(saleRef, {
      transactionNo,
      cashierId,
      subtotal,
      discount,
      total,
      paymentMethod,
      amountTendered: tendered,
      changeAmount: change,
      paymentReference: paymentReference || null,
      status: 'completed',
      voidStatus: null,
      createdAt: serverTimestamp(),
    });

    lines.forEach((line) => {
      const itemRef = doc(collection(db, 'sales', saleRef.id, 'items'));
      tx.set(itemRef, {
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        createdAt: serverTimestamp(),
      });

      tx.update(line.ref, { currentStock: increment(-line.quantity), updatedAt: serverTimestamp() });

      const invRef = doc(collection(db, 'inventoryTransactions'));
      tx.set(invRef, {
        productId: line.productId,
        type: InventoryTypes.SALE,
        quantity: -line.quantity,
        referenceId: saleRef.id,
        referenceType: 'sale',
        note: null,
        userId: cashierId,
        createdAt: serverTimestamp(),
      });
    });

    return { saleId: saleRef.id, transactionNo };
  });
}

export async function getRecentSales(max = 8) {
  const q = query(collection(db, 'sales'), where('status', '==', 'completed'), orderBy('createdAt', 'desc'), fbLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSaleWithItems(saleId) {
  const saleSnap = await getDoc(doc(db, 'sales', saleId));
  if (!saleSnap.exists()) return null;

  const itemsSnap = await getDocs(collection(db, 'sales', saleId, 'items'));
  return {
    id: saleSnap.id,
    ...saleSnap.data(),
    items: itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}
