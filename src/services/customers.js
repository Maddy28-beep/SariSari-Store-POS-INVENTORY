import {
  collection, doc, setDoc, query, where, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDocsSafe, settleFast } from '../firebase/offline';

export async function getCustomers() {
  const snap = await getDocsSafe(query(collection(db, 'customers'), orderBy('nameLower')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Works offline - saved on the device, synced later. */
export async function addCustomer({ name, phone }, userId) {
  const ref = doc(collection(db, 'customers'));
  const customer = {
    name: name.trim(),
    nameLower: name.trim().toLowerCase(),
    phone: (phone || '').trim() || null,
    createdBy: userId,
  };
  await settleFast(setDoc(ref, { ...customer, createdAt: serverTimestamp() }));
  return { id: ref.id, ...customer };
}

/** Every sale tied to this customer (newest first) - their purchase history. */
export async function getCustomerSales(customerId) {
  const snap = await getDocsSafe(query(collection(db, 'sales'), where('customerId', '==', customerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}
