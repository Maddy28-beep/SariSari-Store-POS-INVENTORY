// Seeds Firestore with sample categories, units, suppliers, and a realistic
// Filipino sari-sari store product catalog (snacks, instant food, drinks,
// coffee, grocery, household, tobacco, feeds). Safe to re-run — it skips
// anything that already exists (matched by name / barcode).
//
// Usage:
//   npm run seed -- owner@email.com theirPassword
// or set SEED_EMAIL / SEED_PASSWORD in your environment / .env file.
//
// Must be run with an existing Owner or Admin account's credentials —
// Firestore rules only allow catalog/product writes from that role.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, collection, getDocs, addDoc, doc, runTransaction, updateDoc,
  query, where, serverTimestamp, increment,
} from 'firebase/firestore';

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

const env = { ...loadDotEnv(), ...process.env };

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Missing Firebase config — make sure .env exists (see .env.example).');
  process.exit(1);
}

const email = env.SEED_EMAIL || process.argv[2];
const password = env.SEED_PASSWORD || process.argv[3];

if (!email || !password) {
  console.error('Usage: npm run seed -- <owner-or-admin-email> <password>');
  console.error('   or: set SEED_EMAIL and SEED_PASSWORD in your environment.');
  process.exit(1);
}

const CATEGORIES = ['Snacks', 'Instant Food', 'Drinks', 'Coffee', 'Grocery', 'Feeds', 'Tobacco', 'Household', 'Others'];

const UNITS = [
  { name: 'Piece', abbreviation: 'pc', allowDecimal: false },
  { name: 'Kilogram', abbreviation: 'kg', allowDecimal: true },
  { name: 'Gram', abbreviation: 'g', allowDecimal: true },
  { name: 'Liter', abbreviation: 'L', allowDecimal: true },
  { name: 'Milliliter', abbreviation: 'mL', allowDecimal: true },
  { name: 'Sack', abbreviation: 'sack', allowDecimal: true },
  { name: 'Pack', abbreviation: 'pack', allowDecimal: false },
  { name: 'Box', abbreviation: 'box', allowDecimal: false },
];

const SUPPLIER_BY_CATEGORY = {
  Snacks: 'URC Distributors',
  'Instant Food': 'Monde Nissin Distributors',
  Drinks: 'Coca-Cola Beverages Philippines',
  Coffee: 'Nestlé Philippines',
  Grocery: 'Metro Grocery Distributors',
  Feeds: 'B-MEG Feeds',
  Tobacco: 'PMFTC Inc.',
  Household: 'P&G Distributors',
  Others: 'Local Supplier',
};
const SUPPLIERS = [...new Set(Object.values(SUPPLIER_BY_CATEGORY))];

// [name, category, unitAbbr, costPrice, sellingPrice, reorderLevel, initialStock]
const PRODUCTS = [
  // Snacks
  ['Chippy BBQ 110g', 'Snacks', 'pc', 12, 15, 20, 60],
  ['Piattos Cheese 85g', 'Snacks', 'pc', 28, 33, 15, 40],
  ['Nova Multigrain Barbecue 78g', 'Snacks', 'pc', 22, 26, 15, 40],
  ['Boy Bawang Cornick Garlic 100g', 'Snacks', 'pc', 14, 18, 20, 50],
  ['Clover Chips Barbecue 60g', 'Snacks', 'pc', 9, 12, 25, 60],
  ['Oishi Prawn Crackers 60g', 'Snacks', 'pc', 8, 11, 25, 60],
  ['SkyFlakes Crackers 25g', 'Snacks', 'pc', 6, 8, 30, 80],
  ['Rebisco Sandwich Crackers 31g', 'Snacks', 'pc', 7, 9, 30, 80],
  ['Fita Crackers 30g', 'Snacks', 'pc', 6, 8, 25, 60],
  ['Hansel Sandwich Biscuit 31g', 'Snacks', 'pc', 7, 9, 25, 60],
  ["Cream-O Chocolate 33g", 'Snacks', 'pc', 7, 9, 25, 60],
  ['Chocnut 10s', 'Snacks', 'pc', 15, 20, 15, 30],
  ['Goldilocks Polvoron Classic', 'Snacks', 'pc', 10, 14, 15, 30],
  ['Nagaraya Garlic Peanuts 90g', 'Snacks', 'pc', 20, 25, 15, 30],
  ['V-Cut Potato Chips 60g', 'Snacks', 'pc', 15, 19, 20, 40],
  ['Chiz Curls 110g', 'Snacks', 'pc', 12, 16, 20, 40],
  ['Pillows Chocolate 38g', 'Snacks', 'pc', 8, 11, 25, 50],
  ['Garden Cheese Whirlwinds 60g', 'Snacks', 'pc', 10, 13, 20, 40],
  ['Haw Flakes', 'Snacks', 'pc', 5, 8, 20, 40],
  ['Mik-Mik Chocolate Drink Powder', 'Snacks', 'pc', 3, 5, 30, 60],

  // Instant Food
  ['Lucky Me Pancit Canton Original 60g', 'Instant Food', 'pc', 9, 12, 40, 100],
  ['Lucky Me Pancit Canton Chilimansi 60g', 'Instant Food', 'pc', 9, 12, 40, 100],
  ['Lucky Me Beef Mami 55g', 'Instant Food', 'pc', 8, 11, 30, 70],
  ['Lucky Me La Paz Batchoy 55g', 'Instant Food', 'pc', 8, 11, 25, 60],
  ['Nissin Cup Noodles Seafood 40g', 'Instant Food', 'pc', 18, 23, 15, 30],
  ['Payless Instant Mami 50g', 'Instant Food', 'pc', 6, 9, 25, 50],

  // Grocery
  ['Argentina Corned Beef 150g', 'Grocery', 'pc', 28, 35, 15, 30],
  ['Century Tuna Flakes in Oil 155g', 'Grocery', 'pc', 30, 38, 15, 30],
  ['555 Sardines in Tomato Sauce 155g', 'Grocery', 'pc', 15, 20, 20, 40],
  ['Ligo Sardines Spanish Style 155g', 'Grocery', 'pc', 18, 23, 15, 30],
  ['CDO Corned Beef 150g', 'Grocery', 'pc', 25, 32, 15, 30],
  ['Purefoods Corned Beef 150g', 'Grocery', 'pc', 26, 33, 15, 30],
  ['Maling Luncheon Meat 340g', 'Grocery', 'pc', 60, 75, 10, 20],
  ['Datu Puti Soy Sauce 385mL', 'Grocery', 'pc', 20, 26, 20, 40],
  ['Datu Puti Vinegar 385mL', 'Grocery', 'pc', 18, 23, 20, 40],
  ['Silver Swan Soy Sauce 385mL', 'Grocery', 'pc', 20, 26, 15, 30],
  ['Knorr Sinigang sa Sampalok Mix 44g', 'Grocery', 'pc', 10, 14, 20, 40],
  ['Knorr Pork Cube 60g', 'Grocery', 'pc', 12, 16, 20, 40],
  ['Maggi Magic Sarap 50g', 'Grocery', 'pc', 11, 15, 20, 40],
  ['UFC Banana Ketchup 320g', 'Grocery', 'pc', 22, 28, 15, 30],
  ['Jasmine Rice', 'Grocery', 'sack', 1400, 1600, 3, 10],
  ['White Sugar', 'Grocery', 'kg', 55, 65, 10, 40],
  ['Cooking Oil (Minola) 1L', 'Grocery', 'L', 85, 98, 10, 30],
  ['Iodized Salt 500g', 'Grocery', 'pc', 8, 12, 15, 30],
  ['Spaghetti Noodles 1kg', 'Grocery', 'pc', 55, 68, 10, 20],

  // Drinks
  ['Coca-Cola 1.5L', 'Drinks', 'pc', 55, 68, 15, 30],
  ['Sprite 1.5L', 'Drinks', 'pc', 55, 68, 15, 30],
  ['Royal 1.5L', 'Drinks', 'pc', 55, 68, 15, 30],
  ['Pop Cola 1.5L', 'Drinks', 'pc', 40, 50, 15, 30],
  ["Nature's Spring Water 500mL", 'Drinks', 'pc', 8, 12, 30, 60],
  ['Wilkins Distilled Water 500mL', 'Drinks', 'pc', 9, 13, 30, 60],
  ['Zesto Orange Juice 200mL', 'Drinks', 'pc', 7, 10, 30, 60],
  ['Tang Orange Powder 25g', 'Drinks', 'pc', 5, 8, 20, 40],
  ['C2 Green Tea Apple 500mL', 'Drinks', 'pc', 20, 25, 20, 40],
  ['Gatorade Blue Bolt 500mL', 'Drinks', 'pc', 28, 35, 15, 30],

  // Coffee
  ['Nescafé 3-in-1 Original 20g', 'Coffee', 'pc', 7, 9, 40, 100],
  ['Kopiko Black 3-in-1 25g', 'Coffee', 'pc', 8, 10, 30, 80],
  ['Great Taste White 3-in-1 23g', 'Coffee', 'pc', 7, 9, 30, 80],
  ['San Mig Coffee 3-in-1 25g', 'Coffee', 'pc', 7, 9, 25, 60],

  // Household
  ['Tide Powder Detergent 68g', 'Household', 'pc', 8, 11, 25, 50],
  ['Surf Powder Detergent 55g', 'Household', 'pc', 7, 10, 25, 50],
  ['Champion Detergent Bar', 'Household', 'pc', 15, 19, 20, 40],
  ['Joy Dishwashing Liquid 250mL', 'Household', 'pc', 30, 37, 15, 25],
  ['Downy Fabric Conditioner 180mL', 'Household', 'pc', 20, 26, 15, 25],
  ['Safeguard Bar Soap', 'Household', 'pc', 18, 23, 20, 40],
  ['Head & Shoulders Shampoo Sachet', 'Household', 'pc', 5, 7, 40, 80],
  ['Colgate Toothpaste 150g', 'Household', 'pc', 45, 55, 10, 20],
  ['Kleenex Facial Tissue', 'Household', 'pc', 25, 32, 15, 25],
  ['Energizer AA Battery 2pc', 'Household', 'pc', 25, 32, 15, 25],

  // Tobacco
  ['Marlboro Red', 'Tobacco', 'pack', 120, 140, 10, 20],
  ['Fortune Red', 'Tobacco', 'pack', 95, 115, 10, 20],
  ['Winston Red', 'Tobacco', 'pack', 100, 120, 10, 20],

  // Feeds
  ['B-Meg Hog Starter', 'Feeds', 'sack', 900, 1000, 2, 6],
  ['Chick Booster Feeds', 'Feeds', 'kg', 45, 55, 5, 15],

  // Others
  ['Candle', 'Others', 'pc', 5, 8, 20, 40],
  ['Matches', 'Others', 'box', 3, 5, 20, 40],
  ['Ice Candy', 'Others', 'pc', 3, 5, 30, 60],
];

function barcodeFor(index) {
  return `480${String(1000000000 + index).slice(-9)}`;
}

async function getOrCreate(db, colName, nameField, items, extraFields = () => ({})) {
  const snap = await getDocs(collection(db, colName));
  const existing = new Map(snap.docs.map((d) => [d.data()[nameField], d.id]));
  for (const name of items) {
    if (!existing.has(name)) {
      const ref = await addDoc(collection(db, colName), { [nameField]: name, isActive: true, ...extraFields(name) });
      existing.set(name, ref.id);
      console.log(`  + ${colName}: ${name}`);
    }
  }
  return existing;
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`Signing in as ${email}...`);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const userId = cred.user.uid;

  console.log('Seeding categories...');
  const categoryIds = await getOrCreate(db, 'categories', 'name', CATEGORIES);

  console.log('Seeding units...');
  const unitSnap = await getDocs(collection(db, 'units'));
  const unitByAbbr = new Map(unitSnap.docs.map((d) => [d.data().abbreviation, { id: d.id, ...d.data() }]));
  for (const u of UNITS) {
    if (!unitByAbbr.has(u.abbreviation)) {
      const ref = await addDoc(collection(db, 'units'), u);
      unitByAbbr.set(u.abbreviation, { id: ref.id, ...u });
      console.log(`  + unit: ${u.name}`);
    } else if (!!unitByAbbr.get(u.abbreviation).allowDecimal !== u.allowDecimal) {
      const old = unitByAbbr.get(u.abbreviation);
      await updateDoc(doc(db, 'units', old.id), { allowDecimal: u.allowDecimal });
      const prods = await getDocs(query(collection(db, 'products'), where('unitId', '==', old.id)));
      for (const p of prods.docs) await updateDoc(p.ref, { allowDecimal: u.allowDecimal });
      unitByAbbr.set(u.abbreviation, { ...old, allowDecimal: u.allowDecimal });
      console.log(`  ~ unit ${u.name}: allowDecimal -> ${u.allowDecimal} (${prods.size} products)`);
    }
  }

  console.log('Seeding suppliers...');
  const supplierIds = await getOrCreate(db, 'suppliers', 'name', SUPPLIERS);

  console.log(`Seeding ${PRODUCTS.length} products...`);
  let created = 0;
  let skipped = 0;
  for (let i = 0; i < PRODUCTS.length; i++) {
    const [name, category, unitAbbr, costPrice, sellingPrice, reorderLevel, initialStock] = PRODUCTS[i];
    const barcode = barcodeFor(i);

    const existing = await getDocs(query(collection(db, 'products'), where('barcode', '==', barcode)));
    if (!existing.empty) {
      skipped++;
      continue;
    }

    const unit = unitByAbbr.get(unitAbbr);
    const productRef = await addDoc(collection(db, 'products'), {
      barcode,
      name,
      nameLower: name.toLowerCase(),
      categoryId: categoryIds.get(category) || null,
      unitId: unit.id,
      unit: unit.abbreviation,
      allowDecimal: !!unit.allowDecimal,
      supplierId: supplierIds.get(SUPPLIER_BY_CATEGORY[category]) || null,
      costPrice,
      sellingPrice,
      reorderLevel,
      currentStock: 0,
      status: 'active',
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Record the opening balance the same way the app does for every other
    // stock movement, so the audit trail (inventoryTransactions) stays consistent.
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(productRef);
      const stockAfter = snap.data().currentStock + initialStock;
      tx.update(productRef, { currentStock: increment(initialStock), updatedAt: serverTimestamp() });
      tx.set(doc(collection(db, 'inventoryTransactions')), {
        productId: productRef.id,
        type: 'beginning',
        quantity: initialStock,
        stockAfter,
        referenceId: null,
        referenceType: null,
        note: 'Seed data — opening balance',
        userId,
        createdAt: serverTimestamp(),
      });
    });

    created++;
    console.log(`  + product: ${name}`);
  }

  console.log(`\nDone. ${created} products created, ${skipped} already existed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
