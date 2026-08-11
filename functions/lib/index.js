"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCustomerAccount = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const PLATFORM_ADMIN_EMAILS = [
    "admin@voicera.ai",
    "admin@vocera.ai",
    "platform@heuristiclabs.ai",
    "admin@heuristiclabs.ai",
];
function assertPlatformAdmin(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const role = context.auth.token.role;
    const email = (context.auth.token.email || "").toLowerCase();
    const isAdmin = role === "platform_admin" || PLATFORM_ADMIN_EMAILS.includes(email);
    if (!isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Only Platform Admins can create customer accounts.");
    }
}
/**
 * createCustomerAccount
 *
 * Secure callable — creates/updates a customer tenant.
 * Requires authenticated platform_admin (claim or bootstrap email list).
 */
exports.createCustomerAccount = functions.https.onCall(async (data, context) => {
    assertPlatformAdmin(context);
    const { email, password, orgName, contactName, plan, agents, resetPassword } = data;
    if (!email || !orgName) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields: email or orgName.");
    }
    if (password && typeof password === "string" && password.length < 12) {
        throw new functions.https.HttpsError("invalid-argument", "Password must be at least 12 characters.");
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const agentList = Array.isArray(agents) ? agents : [];
    // Existing accounts: only reset password when explicitly requested (default false).
    const shouldResetPassword = resetPassword === true;
    try {
        let userRecord;
        let existingUser = false;
        try {
            userRecord = await admin.auth().getUserByEmail(normalizedEmail);
            existingUser = true;
            const updates = {
                displayName: contactName || userRecord.displayName,
            };
            if (shouldResetPassword && password) {
                updates.password = password;
            }
            await admin.auth().updateUser(userRecord.uid, updates);
        }
        catch (authErr) {
            if (authErr.code !== "auth/user-not-found")
                throw authErr;
            if (!password) {
                throw new functions.https.HttpsError("invalid-argument", "Password is required when creating a new account.");
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
        }
        else {
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
    }
    catch (error) {
        console.error("Error creating customer account:", error?.code || error?.message || error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", "Unable to create customer account.");
    }
});
//# sourceMappingURL=index.js.map