import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { safeLog } from "./safeLog";

export async function recordAuditEvent(input: {
  action: string;
  orgId?: string;
  targetEmail?: string;
  detail?: string;
}): Promise<void> {
  try {
    await httpsCallable(functions, "recordAuditEvent")(input);
  } catch (err) {
    safeLog.warn("audit event not recorded", err);
  }
}

export async function revokeMySessions(): Promise<void> {
  await httpsCallable(functions, "revokeMySessions")({});
}

export async function adminUpdateOrganization(input: {
  orgId: string;
  status?: "active" | "suspended" | "trial";
  subscribedAgents?: string[];
}): Promise<void> {
  await httpsCallable(functions, "adminUpdateOrganization")(input);
}

export async function offboardCustomer(orgId: string): Promise<void> {
  await httpsCallable(functions, "offboardCustomer")({ orgId });
}
