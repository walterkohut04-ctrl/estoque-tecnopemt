import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDUS5jNqXx_LFuIxfeL71i2nSBjdUYnegw",
  authDomain: "estoque-tecnopemt.firebaseapp.com",
  projectId: "estoque-tecnopemt",
  storageBucket: "estoque-tecnopemt.firebasestorage.app",
  messagingSenderId: "487826601229",
  appId: "1:487826601229:web:0eb746f0d23e3754296c44",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
