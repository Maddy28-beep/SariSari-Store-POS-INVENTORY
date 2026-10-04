import {
  collection, doc, setDoc, deleteDoc, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDocsSafe, settleFast } from '../firebase/offline';
import { rangeFor } from './reports';

export const EXPENSE_CATEGORIES = [
  'Restocking', 'Electricity', 'Water', 'Rent', 'Salary', 'Transport', 'Supplies', 'Other',
];

/** Works offline: the expense is saved on the device and syncs when the internet returns. */
export async function addExpense({ description, category, amount, recordedBy }) {
  const ref = doc(collection(db, 'expenses'));
  await settleFast(setDoc(ref, {
    description: description.trim(),
    category,
    amount: Math.round(Number(amount) * 100) / 100,
    recordedBy,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
}

export async function deleteExpense(id) {
  return settleFast(deleteDoc(doc(db, 'expenses', id)));
}

export async function getExpensesInRange(period) {
  const { start } = rangeFor(period);
  const q = query(collection(db, 'expenses'), where('createdAt', '>=', start), orderBy('createdAt', 'desc'));
  const snap = await getDocsSafe(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
}

export function summarizeExpenses(expenses) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = {};
  expenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  return {
    total,
    byCategory: Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
