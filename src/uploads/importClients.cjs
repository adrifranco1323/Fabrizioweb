const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const fs = require('fs');
const csv = require('csv-parser'); // Asegúrate de instalarlo con: npm install csv-parser

// Usa la misma configuración de tu proyecto Firebase
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
const db = getFirestore(app, "fabriziodb");

async function importData() {
  const results = [];

 fs.createReadStream('./src/uploads/clients.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`Procesando ${results.length} registros...`);

      for (const row of results) {
        try {
          // Mapeamos las columnas de tu CSV a la estructura de Firebase
          await addDoc(collection(db, 'clients'), {
            firstName: row.Nombres || '',
            lastName: row.Apellidos || '',
            phone: row.Telefono || '',
            email: row.Correo || '',
            lp: row.LP || '',
            cars: row.CARS || ''
          });
          console.log(`Importado: ${row.Nombres} ${row.Apellidos}`);
        } catch (error) {
          console.error('Error al subir registro:', error);
        }
      }
      console.log('¡Importación de clientes finalizada!');
    });
}

importData();