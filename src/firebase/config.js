import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDSnbExE8wOcSNnkfs1h4mVPtA06RBPu3c",
  authDomain: "fabricio-3a3d7.firebaseapp.com",
  projectId: "fabricio-3a3d7",
  storageBucket: "fabricio-3a3d7.firebasestorage.app",
  messagingSenderId: "869464870310",
  appId: "1:869464870310:web:2331eda1872a7ffe1b1367",
  measurementId: "G-9567Y2NLKM"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, "fabriziodb"); // Conexión explícita
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Segunda instancia de Firebase usada solo para crear usuarios nuevos sin
// cerrar la sesión del administrador actual (createUser inicia sesión como el nuevo usuario).
const secondaryApp = getApps().some(a => a.name === 'Secondary')
  ? getApps().find(a => a.name === 'Secondary')
  : initializeApp(firebaseConfig, 'Secondary');
export const secondaryAuth = getAuth(secondaryApp);
