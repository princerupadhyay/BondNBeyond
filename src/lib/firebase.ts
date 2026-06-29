import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile as fbUpdateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  type Firestore,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDDyyVAxOBuZEjqBnACTG37hD8vovYTrWY',
  authDomain: 'bondandbeyond.firebaseapp.com',
  projectId: 'bondandbeyond',
  storageBucket: 'bondandbeyond.firebasestorage.app',
  messagingSenderId: '775648953538',
  appId: '1:775648953538:web:5a8ce2d0c7860e0d47a75b',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence).catch(console.error);

export {
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  fbUpdateProfile,
  type FirebaseUser,
};

export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  type DocumentData,
  type QueryConstraint,
};

export async function uploadAvatar(file: File, uid: string): Promise<string> {
  const storageRef = ref(storage, `avatars/${uid}/${Date.now()}-${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadStudyProof(file: File, uid: string): Promise<string> {
  const folder = file.type.startsWith('image/') ? 'study-proofs' : 'notes';
  const storageRef = ref(storage, `${folder}/${uid}/${Date.now()}-${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
