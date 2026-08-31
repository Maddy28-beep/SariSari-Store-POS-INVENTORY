import { collection, doc, getDocs, setDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import {
  createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail,
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { auth, db, app as mainApp } from '../firebase/config';

export async function getAllUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Creates a new staff account without signing out the currently logged-in owner.
 * Uses a secondary, throwaway Firebase app instance so the primary auth session is untouched.
 */
export async function createStaffUser({ name, email, password, role }) {
  const secondaryApp = initializeApp(mainApp.options, 'secondary-' + Date.now());
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);

    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      email,
      role,
      isActive: true,
      createdAt: new Date(),
    });

    return cred.user.uid;
  } finally {
    await secondaryAuth.signOut();
    await deleteApp(secondaryApp);
  }
}

export async function updateUserProfile(uid, data) {
  return updateDoc(doc(db, 'users', uid), data);
}

/** Client SDKs can't set another user's password directly; send them a reset email instead. */
export async function sendStaffPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}
