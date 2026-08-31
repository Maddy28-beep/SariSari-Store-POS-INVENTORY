import { collection, getDocs, addDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase/config';

export async function getCategories() {
  const snap = await getDocs(query(collection(db, 'categories'), where('isActive', '==', true), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUnits() {
  const snap = await getDocs(query(collection(db, 'units'), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSuppliers() {
  const snap = await getDocs(query(collection(db, 'suppliers'), where('isActive', '==', true), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function seedDefaults() {
  const categories = ['Snacks', 'Instant Food', 'Drinks', 'Coffee', 'Grocery', 'Feeds', 'Tobacco', 'Household', 'Others'];
  const units = [
    { name: 'Piece', abbreviation: 'pc', allowDecimal: false },
    { name: 'Kilogram', abbreviation: 'kg', allowDecimal: true },
    { name: 'Gram', abbreviation: 'g', allowDecimal: true },
    { name: 'Liter', abbreviation: 'L', allowDecimal: true },
    { name: 'Milliliter', abbreviation: 'mL', allowDecimal: true },
    { name: 'Sack', abbreviation: 'sack', allowDecimal: false },
    { name: 'Pack', abbreviation: 'pack', allowDecimal: false },
    { name: 'Box', abbreviation: 'box', allowDecimal: false },
  ];

  const existingCategories = await getDocs(collection(db, 'categories'));
  if (existingCategories.empty) {
    await Promise.all(categories.map((name) => addDoc(collection(db, 'categories'), { name, isActive: true })));
  }

  const existingUnits = await getDocs(collection(db, 'units'));
  if (existingUnits.empty) {
    await Promise.all(units.map((u) => addDoc(collection(db, 'units'), u)));
  }
}
