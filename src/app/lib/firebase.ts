/**
 * firebase.ts — Firebase app & auth singleton
 *
 * Copy .env.example → .env.local and fill VITE_FIREBASE_* from Firebase Console.
 * Without those vars the app runs in local demo auth mode (see AuthContext).
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";
import { getFirestore, enableNetwork, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string | undefined,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string | undefined,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string | undefined,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string | undefined,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey?.trim() &&
  firebaseConfig.authDomain?.trim() &&
  firebaseConfig.projectId?.trim() &&
  firebaseConfig.appId?.trim(),
);

export const app: FirebaseApp | null = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const functions: Functions | null = app ? getFunctions(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;

if (db) {
  void enableNetwork(db).catch(() => {});
} else if (import.meta.env.DEV) {
  console.warn(
    "[Voicera] Firebase env missing — local demo auth enabled. " +
      "Copy .env.example → .env.local and add your Firebase web config.",
  );
}
