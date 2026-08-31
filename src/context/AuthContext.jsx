import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase/config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;

    setLoading(true);
    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    return unsubProfile;
  }, [user]);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin';
  const isOwner = profile?.role === 'owner';
  const isCashier = profile?.role === 'cashier';

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, isOwnerOrAdmin, isOwner, isCashier }}>
      {!isFirebaseConfigured ? <FirebaseNotConfigured /> : children}
    </AuthContext.Provider>
  );
}

function FirebaseNotConfigured() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: '100vh' }}>
      <div className="fs-1 mb-3">🏪</div>
      <h1 className="h4">Firebase isn't configured yet</h1>
      <p className="text-secondary" style={{ maxWidth: 480 }}>
        Copy <code>.env.example</code> to <code>.env</code> and fill in your Firebase project's config values
        (see the README for step-by-step setup), then restart the dev server.
      </p>
    </div>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
