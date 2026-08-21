import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { safeLog } from "./safeLog";

export async function recordAuditEvent(input: {
  action: string;
  orgId?: string;
  targetEmail?: string;
  detail?: string;
}): Promise<void> {
  if (!functions) return;
  try {
    await httpsCallable(functions, "recordAuditEvent")(input);
  } catch (err) {
    safeLog.warn("audit event not recorded", err);
  }
}

export async function revokeMySessions(): Promise<void> {
  if (!functions) return;
  await httpsCallable(functions, "revokeMySessions")({});
}

export async function adminUpdateOrganization(input: {
  orgId: string;
  status?: "active" | "suspended" | "trial";
  subscribedAgents?: string[];
}): Promise<void> {
  if (!functions) throw new Error("Firebase Functions is not configured.");
  await httpsCallable(functions, "adminUpdateOrganization")(input);
}

export async function offboardCustomer(orgId: string): Promise<void> {
  if (!functions) throw new Error("Firebase Functions is not configured.");
  await httpsCallable(functions, "offboardCustomer")({ orgId });
}
