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
exports.offboardCustomer = exports.adminUpdateOrganization = exports.revokeMySessions = exports.recordAuditEvent = exports.createCustomerAccount = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const PLATFORM_ADMIN_EMAILS = [
    "admin@voicera.ai",
    "admin@vocera.ai",
    "platform@heuristiclabs.ai",
    "admin@heuristiclabs.ai",
];
const PLAN_CREDITS = {
    Starter: 5000,
    Growth: 20000,
    Enterprise: 100000,
};
const AUDIT_ACTIONS = new Set([
    "login",
    "logout",
    "create_account",
    "update_account",
    "suspend_account",
    "reactivate_account",
    "update_agents",
    "offboard_account",
    "revoke_sessions",
    "mfa_enroll",
    "view_usage",
]);
function isPlatformAdminToken(context) {
    if (!context.auth)
        return false;
    const role = context.auth.token.role;
    const email = (context.auth.token.email || "").toLowerCase();
    return role === "platform_admin" || PLATFORM_ADMIN_EMAILS.includes(email);
}
function assertAuthenticated(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }
}
function assertPlatformAdmin(context) {
    assertAuthenticated(context);
    if (!isPlatformAdminToken(context)) {
        throw new functions.https.HttpsError("permission-denied", "Only Platform Admins can perform this action.");
    }
}
async function writeAudit(entry) {
    await admin.firestore().collection("audit_events").add({
        action: entry.action,
        actorUid: entry.actorUid,
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole || "",
        orgId: entry.orgId || "",
        targetEmail: entry.targetEmail || "",
        detail: (entry.detail || "").slice(0, 300),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
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
    const shouldResetPassword = resetPassword === true;
    const planName = plan || "Starter";
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
            plan: planName,
            status: "active",
            ownerUid: userRecord.uid,
            subscribedAgents: agentList,
            creditsLimit: PLAN_CREDITS[planName] ?? PLAN_CREDITS.Starter,
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
        await writeAudit({
            action: existingUser ? "update_account" : "create_account",
            actorUid: context.auth.uid,
            actorEmail: context.auth.token.email || "",
            actorRole: "platform_admin",
            orgId,
            targetEmail: normalizedEmail,
            detail: `${orgName} · ${agentList.length} agent(s)`,
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
        console.error("createCustomerAccount:", error?.code || "error");
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", "Unable to create customer account.");
    }
});
exports.recordAuditEvent = functions.https.onCall(async (data, context) => {
    assertAuthenticated(context);
    const action = String(data?.action || "");
    if (!AUDIT_ACTIONS.has(action)) {
        throw new functions.https.HttpsError("invalid-argument", "Unknown audit action.");
    }
    const isAdmin = isPlatformAdminToken(context);
    const tokenOrg = context.auth.token.orgId || "";
    const orgId = isAdmin ? String(data?.orgId || tokenOrg || "") : tokenOrg;
    await writeAudit({
        action,
        actorUid: context.auth.uid,
        actorEmail: context.auth.token.email || "",
        actorRole: isAdmin ? "platform_admin" : String(context.auth.token.role || "customer_admin"),
        orgId,
        targetEmail: isAdmin ? String(data?.targetEmail || "") : "",
        detail: String(data?.detail || "").slice(0, 300),
    });
    return { ok: true };
});
exports.revokeMySessions = functions.https.onCall(async (_data, context) => {
    assertAuthenticated(context);
    await admin.auth().revokeRefreshTokens(context.auth.uid);
    await writeAudit({
        action: "revoke_sessions",
        actorUid: context.auth.uid,
        actorEmail: context.auth.token.email || "",
        actorRole: String(context.auth.token.role || ""),
        orgId: String(context.auth.token.orgId || ""),
        detail: "Refresh tokens revoked",
    });
    return { ok: true };
});
exports.adminUpdateOrganization = functions.https.onCall(async (data, context) => {
    assertPlatformAdmin(context);
    const orgId = String(data?.orgId || "");
    if (!orgId) {
        throw new functions.https.HttpsError("invalid-argument", "orgId is required.");
    }
    const updates = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    let action = "update_account";
    if (data.status === "active" || data.status === "suspended" || data.status === "trial") {
        updates.status = data.status;
        action = data.status === "suspended" ? "suspend_account" : "reactivate_account";
    }
    if (Array.isArray(data.subscribedAgents)) {
        updates.subscribedAgents = data.subscribedAgents;
        action = "update_agents";
    }
    const ref = admin.firestore().collection("organizations").doc(orgId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Organisation not found.");
    }
    await ref.update(updates);
    await writeAudit({
        action,
        actorUid: context.auth.uid,
        actorEmail: context.auth.token.email || "",
        actorRole: "platform_admin",
        orgId,
        targetEmail: snap.data()?.email || "",
        detail: action === "update_agents"
            ? `${data.subscribedAgents.length} agent(s)`
            : String(data.status || ""),
    });
    return { ok: true };
});
exports.offboardCustomer = functions.https.onCall(async (data, context) => {
    assertPlatformAdmin(context);
    const orgId = String(data?.orgId || "");
    if (!orgId) {
        throw new functions.https.HttpsError("invalid-argument", "orgId is required.");
    }
    const ref = admin.firestore().collection("organizations").doc(orgId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Organisation not found.");
    }
    const org = snap.data() || {};
    const ownerUid = org.ownerUid;
    const email = org.email || "";
    if (ownerUid) {
        try {
            await admin.auth().deleteUser(ownerUid);
        }
        catch (err) {
            if (err?.code !== "auth/user-not-found") {
                console.error("offboard deleteUser:", err?.code || "error");
                throw new functions.https.HttpsError("internal", "Unable to delete customer login.");
            }
        }
    }
    await ref.delete();
    await writeAudit({
        action: "offboard_account",
        actorUid: context.auth.uid,
        actorEmail: context.auth.token.email || "",
        actorRole: "platform_admin",
        orgId,
        targetEmail: email,
        detail: `Deleted ${org.orgName || orgId}`,
    });
    return { ok: true };
});
//# sourceMappingURL=index.js.map