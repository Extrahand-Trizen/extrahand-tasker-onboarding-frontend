import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
const hasRequiredConfig = requiredFields.every(
  (field) => !!firebaseConfig[field as keyof typeof firebaseConfig]
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (typeof window !== 'undefined') {
  if (hasRequiredConfig) {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0] as FirebaseApp;
    }
    auth = getAuth(app);
  } else {
    const missing = requiredFields.filter(
      (field) => !firebaseConfig[field as keyof typeof firebaseConfig]
    );
    console.warn(
      `Firebase not configured (missing: ${missing.join(', ')}). Using JWT auth only. Add NEXT_PUBLIC_FIREBASE_* to .env.local to enable Firebase.`
    );
  }
}

export { app, auth };
