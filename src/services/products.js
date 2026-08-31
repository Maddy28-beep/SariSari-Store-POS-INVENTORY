import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where,
  orderBy, limit as fbLimit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

function productsCol() {
  return collection(db, 'products');
}

function unitFields(unit) {
  return unit ? { unit: unit.abbreviation, allowDecimal: !!unit.allowDecimal } : {};
}

export async function lookupByBarcode(barcode) {
  const q = query(productsCol(), where('barcode', '==', barcode), fbLimit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function searchByName(text, max = 15) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const rangeEnd = lower.slice(0, -1) + String.fromCharCode(lower.charCodeAt(lower.length - 1) + 1);
  const q = query(
    productsCol(),
    where('status', '==', 'active'),
    orderBy('nameLower'),
    where('nameLower', '>=', lower),
    where('nameLower', '<', rangeEnd),
    fbLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllProducts() {
  const snap = await getDocs(query(productsCol(), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProduct(id) {
  const snap = await getDoc(doc(db, 'products', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createProduct(data, createdBy, unit) {
  return addDoc(productsCol(), {
    barcode: data.barcode || null,
    name: data.name,
    nameLower: data.name.toLowerCase(),
    categoryId: data.categoryId || null,
    unitId: data.unitId,
    ...unitFields(unit),
    supplierId: data.supplierId || null,
    costPrice: Number(data.costPrice),
    sellingPrice: Number(data.sellingPrice),
    reorderLevel: Number(data.reorderLevel),
    currentStock: 0,
    status: 'active',
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProduct(id, data, unit) {
  return updateDoc(doc(db, 'products', id), {
    ...data,
    ...(data.name ? { nameLower: data.name.toLowerCase() } : {}),
    ...unitFields(unit),
    updatedAt: serverTimestamp(),
  });
}

export function stockStatus(product) {
  if (product.currentStock <= 0) return 'out';
  if (product.currentStock <= product.reorderLevel) return 'low';
  return 'ok';
}
