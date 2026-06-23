import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  type DocumentData
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  type User
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCBOlvwkw25gmRhL_dcNihOZ-i1h3yTAQY",
  authDomain: "ordinal-hold-t07pf.firebaseapp.com",
  projectId: "ordinal-hold-t07pf",
  storageBucket: "ordinal-hold-t07pf.firebasestorage.app",
  messagingSenderId: "409991170295",
  appId: "1:409991170295:web:5d4616f330875280b5abf2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
};
