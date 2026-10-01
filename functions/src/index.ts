/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getApp, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
// import {onRequest} from "firebase-functions/https";
// import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

initializeApp();

const INITIAL_ADMIN_UID = "Z1bcROoshfhExCgPhD1FWS8zDDp1";

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Solo un admin puede cambiar la contraseña de otro usuario (Firebase nunca expone
// contraseñas en texto plano, ni siquiera al dueño del proyecto; esto es lo más
// cercano a "gestionarlas" que permite la plataforma).
export const adminSetUserPassword = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  if (callerUid !== INITIAL_ADMIN_UID && request.auth?.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Solo un administrador puede cambiar contraseñas.");
  }

  const targetUid = request.data?.targetUid;
  const newPassword = request.data?.newPassword;
  if (typeof targetUid !== "string" || !targetUid) {
    throw new HttpsError("invalid-argument", "Falta el usuario objetivo.");
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    throw new HttpsError("invalid-argument", "La contraseña debe tener al menos 6 caracteres.");
  }

  await getAuth().updateUser(targetUid, {password: newPassword});
  return {success: true};
});

export const adminSetUserRole = onCall(async (request) => {
  if (request.auth?.uid !== INITIAL_ADMIN_UID && request.auth?.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Solo el administrador principal puede cambiar roles.");
  }
  const {targetUid, role, username} = request.data || {};
  if (typeof targetUid !== "string" || !targetUid || !["admin", "assistant", "maid"].includes(role)) {
    throw new HttpsError("invalid-argument", "Usuario o rol inválido.");
  }
  if (targetUid === INITIAL_ADMIN_UID && role !== "admin") {
    throw new HttpsError("failed-precondition", "El administrador principal no se puede degradar.");
  }
  const auth = getAuth();
  const target = await auth.getUser(targetUid);
  await auth.setCustomUserClaims(targetUid, {...target.customClaims, role});
  const db = getFirestore(getApp(), "fabriziodb");
  await db.collection("users").doc(targetUid).set({
    username: typeof username === "string" ? username : (target.displayName || target.email?.split("@")[0] || ""),
    role,
  }, {merge: true});
  return {success: true};
});

export const adminDeleteUser = onCall(async (request) => {
  if (request.auth?.uid !== INITIAL_ADMIN_UID && request.auth?.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Solo un administrador puede eliminar usuarios.");
  }
  const targetUid = request.data?.targetUid;
  if (typeof targetUid !== "string" || !targetUid || targetUid === INITIAL_ADMIN_UID || targetUid === request.auth?.uid) {
    throw new HttpsError("invalid-argument", "No se puede eliminar este usuario.");
  }
  const db = getFirestore(getApp(), "fabriziodb");
  await db.collection("users").doc(targetUid).delete();
  await getAuth().deleteUser(targetUid);
  return {success: true};
});

export const ownerSignIn = onCall(async (request) => {
  const code = typeof request.data?.accessCode === "string" ? request.data.accessCode.trim().toUpperCase() : "";
  if (!code) throw new HttpsError("invalid-argument", "Falta el código de acceso.");
  const db = getFirestore(getApp(), "fabriziodb");
  const propertyQuery = await db.collection("properties").where("accessCode", "==", code).limit(1).get();
  if (propertyQuery.empty) throw new HttpsError("permission-denied", "Código inválido.");
  const propertyId = propertyQuery.docs[0].id;
  const token = await getAuth().createCustomToken(`owner_${propertyId}`, {role: "owner", propertyId});
  return {token, propertyId};
});

export const migrateCalendarData = onCall(async (request) => {
  if (request.auth?.uid !== INITIAL_ADMIN_UID) {
    throw new HttpsError("permission-denied", "Solo el administrador principal puede migrar los datos.");
  }
  const db = getFirestore(getApp(), "fabriziodb");
  const [properties, clients, providers, users] = await Promise.all([
    db.collection("properties").get(),
    db.collection("clients").get(),
    db.collection("providers").get(),
    db.collection("users").get(),
  ]);
  const clientNames = new Map(clients.docs.map((client) => {
    const data = client.data();
    return [client.id, `${data.firstName || ""} ${data.lastName || ""}`.trim()];
  }));
  let batch = db.batch();
  let operations = 0;
  const commitIfFull = async () => {
    if (operations >= 450) {
      await batch.commit();
      batch = db.batch();
      operations = 0;
    }
  };

  for (const property of properties.docs) {
    const data = property.data();
    const propertyName = data.name || "Casa sin nombre";
    batch.set(db.collection("propertyCalendarDirectory").doc(property.id), {name: propertyName}, {merge: true});
    operations++;
    batch.set(db.collection("propertyStatementDirectory").doc(property.id), {
      name: propertyName,
      ownerName: clientNames.get(data.clientId) || data.ownerName || data.owner || "",
    }, {merge: true});
    operations++;
    for (let index = 0; index < Math.min((data.birthdays || []).length, 4); index++) {
      const birthday = data.birthdays[index];
      if (!birthday.date) continue;
      batch.set(db.collection("birthdays").doc(`${property.id}_${index}`), {
        propertyId: property.id,
        propertyName,
        name: birthday.name || "",
        date: birthday.date,
        note: birthday.note || "",
      }, {merge: true});
      operations++;
      await commitIfFull();
    }
    await commitIfFull();
  }

  for (const provider of providers.docs) {
    batch.set(db.collection("providerDirectory").doc(provider.id), {name: provider.data().name || ""}, {merge: true});
    operations++;
    await commitIfFull();
  }
  if (operations) await batch.commit();

  for (const user of users.docs) {
    const role = user.id === INITIAL_ADMIN_UID ? "admin" : user.data().role;
    if (["admin", "assistant", "maid"].includes(role)) {
      const authUser = await getAuth().getUser(user.id);
      await getAuth().setCustomUserClaims(user.id, {...authUser.customClaims, role});
    }
  }
  return {properties: properties.size, providers: providers.size};
});

