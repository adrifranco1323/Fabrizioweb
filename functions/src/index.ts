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
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
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

  if (callerUid !== INITIAL_ADMIN_UID) {
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

