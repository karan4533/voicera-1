import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const PLATFORM_ADMIN_EMAILS = [
  "admin@voicera.ai",
  "admin@vocera.ai",
  "platform@heuristiclabs.ai",
  "admin@heuristiclabs.ai",
];

function assertPlatformAdmin(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const role = context.auth.token.role;
  const email = (context.auth.token.email || "").toLowerCase();
  const isAdmin =
    role === "platform_admin" || PLATFORM_ADMIN_EMAILS.includes(email);

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only Platform Admins can create customer accounts."
    );
  }
}

/**
 * createCustomerAccount
 *
 * Secure callable — creates/updates a customer tenant.
 * Requires authenticated platform_admin (claim or bootstrap email list).
 */
export const createCustomerAccount = functions.https.onCall(async (data, context) => {
  assertPlatformAdmin(context);

  const { email, password, orgName, contactName, plan, agents, resetPassword } = data;

  if (!email || !orgName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: email or orgName."
    );
  }

  if (password && typeof password === "string" && password.length < 12) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Password must be at least 12 characters."
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const agentList: string[] = Array.isArray(agents) ? agents : [];
  // Existing accounts: only reset password when explicitly requested (default false).
  const shouldResetPassword = resetPassword === true;

  try {
    let userRecord: admin.auth.UserRecord;
    let existingUser = false;

    try {
      userRecord = await admin.auth().getUserByEmail(normalizedEmail);
      existingUser = true;
      const updates: admin.auth.UpdateRequest = {
        displayName: contactName || userRecord.displayName,
      };
      if (shouldResetPassword && password) {
        updates.password = password;
      }
      await admin.auth().updateUser(userRecord.uid, updates);
    } catch (authErr: any) {
      if (authErr.code !== "auth/user-not-found") throw authErr;
      if (!password) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Password is required when creating a new account."
        );
      }
      userRecord = await admin.auth().createUser({
        email: normalizedEmail,
        password,
        displayName: contactName,
      });
    }

    const orgCollection = admin.firestore().collection("organizations");
    const byOwner = await orgCollection
      .where("ownerUid", "==", userRecord.uid)
      .limit(1)
      .get();
    const byEmail = byOwner.empty
      ? await orgCollection.where("email", "==", normalizedEmail).limit(1).get()
      : byOwner;

    const orgId = !byEmail.empty ? byEmail.docs[0].id : `org-${userRecord.uid}`;
    const orgFields = {
      orgName,
      contactName: contactName || "",
      email: normalizedEmail,
      plan: plan || "Starter",
      status: "active",
      ownerUid: userRecord.uid,
      subscribedAgents: agentList,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!byEmail.empty) {
      await orgCollection.doc(orgId).update(orgFields);
    } else {
      await orgCollection.doc(orgId).set({
        ...orgFields,
        totalCalls: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: "customer_admin",
      orgId,
    });

    return {
      success: true,
      existingUser,
      uid: userRecord.uid,
      orgId,
      message: existingUser
        ? `Updated ${orgName} — assigned ${agentList.length} agent(s).`
        : `Successfully created ${orgName} with ${agentList.length} agent(s).`,
    };
  } catch (error: any) {
    console.error("Error creating customer account:", error?.code || error?.message || error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError(
      "internal",
      "Unable to create customer account."
    );
  }
});
