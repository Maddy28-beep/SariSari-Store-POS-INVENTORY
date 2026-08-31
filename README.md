# Sarisari POS

Barcode-first POS + inventory system for a sari-sari store. React (Vite) + Firebase (Auth + Firestore), deployable to Vercel or Netlify for free.

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com → **Add project** (the free Spark plan is enough).
2. In the project, go to **Build → Authentication → Get started** → enable the **Email/Password** sign-in provider.
3. Go to **Build → Firestore Database → Create database** → start in **production mode**, pick a region close to you.
4. Go to **Project settings → General → Your apps → Add app → Web (`</>`)**, register the app (no need for Firebase Hosting here). Copy the `firebaseConfig` values.

## 2. Configure this project

Copy `.env.example` to `.env` and fill in the values from step 1:

```bash
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Install dependencies:

```bash
npm install
```

## 3. Deploy Firestore security rules

The app has no backend server — Firestore's own security rules (`firestore.rules`) are what enforce that only Owner/Admin can edit prices, only active staff can sell, etc. These must be deployed via the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # pick the project you created in step 1
firebase deploy --only firestore:rules,firestore:indexes
```

## 4. Create the first Owner account

There's no public sign-up screen (staff accounts are created from inside the app by the Owner). So the very first account has to be made by hand:

1. Firebase Console → **Authentication → Users → Add user** — enter an email and password.
2. Copy the new user's **UID**.
3. Firebase Console → **Firestore Database → Start collection** → collection ID `users` → document ID = the UID you copied, with these fields:
   - `name` (string) — your name
   - `email` (string) — same email as the auth user
   - `role` (string) — `owner`
   - `isActive` (boolean) — `true`

Log in with that email/password at `/login`.

## 5. Seed starter data

Log in as the Owner, go to **Settings**, and click **Seed Default Categories & Units** once. This adds the default category list (Snacks, Drinks, Grocery, Feeds, …) and units (pc, kg, L, mL, sack, …) that the Add Product form needs.

From there, use **Users** (Owner only) to create Cashier/Admin accounts — no need to touch the Firebase Console again.

## 6. Run locally

```bash
npm run dev
```

## 7. Deploy to Vercel or Netlify

Both platforms auto-detect this as a Vite app.

**Vercel**: import the repo, framework preset "Vite", and add the six `VITE_FIREBASE_*` env vars from step 2 in the project's Environment Variables settings. `vercel.json` is already set up for client-side routing.

**Netlify**: import the repo (build command `npm run build`, publish directory `dist` — already set in `netlify.toml`), and add the same env vars under Site settings → Environment variables.

Either way, once deployed, don't forget the domain needs to be added to Firebase Console → **Authentication → Settings → Authorized domains**, or login will be blocked.

## Notes on the data model

Firestore is NoSQL, so instead of SQL joins the app denormalizes a few fields for read performance (e.g. each product stores its unit abbreviation directly, each sale line item snapshots the product name at time of sale). Stock is never edited directly — every change (sale, stock-in, adjustment) goes through `inventoryTransactions`, giving the same audit trail the original spec asked for, and product stock updates happen inside Firestore transactions so concurrent sales can't oversell.
