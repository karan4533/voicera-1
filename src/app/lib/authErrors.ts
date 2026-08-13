/**
 * authErrors.ts — Firebase Auth Error Mapper
 *
 * This helper translates raw Firebase Auth error codes into polished,
 * user-friendly, and secure error messages.
 *
 * Security Best Practice:
 * For credential-related failures, we return a generic "Incorrect email or password"
 * message rather than specifying whether the email or password was wrong.
 * This prevents "username harvesting" (user enumeration attacks), where malicious
 * actors probe the login form to determine which email addresses have accounts.
 */

export interface FirebaseErrorLike {
  code?: string;
  message?: string;
}

/**
 * Translates a Firebase authentication error into a user-friendly message.
 */
export function getFriendlyAuthErrorMessage(err: unknown): string {
  let code = "";

  if (err && typeof err === "object") {
    const errorObj = err as FirebaseErrorLike;
    if (typeof errorObj.code === "string") {
      code = errorObj.code;
    } else if (typeof errorObj.message === "string") {
      // Fallback: Parse code from message string if FirebaseError is wrapped or customized
      // Example: "Firebase: Error (auth/invalid-credential)."
      const match = errorObj.message.match(/\((auth\/[^)]+)\)/);
      if (match) {
        code = match[1];
      }
    }
  }

  switch (code) {
    // ── Credential errors ──────────────────────────────────────────────────
    // All credential/user lookup failures must map to the same generic message
    // to prevent user enumeration / username harvesting.
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email or password. Please try again.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/user-disabled":
      return "This account has been disabled. Please contact support for assistance.";

    // ── Rate limiting / Lockout ───────────────────────────────────────────
    case "auth/too-many-requests":
      return "Too many failed login attempts. This account has been temporarily disabled. Please try again later or reset your password.";

    // ── Google / Pop-up auth errors ───────────────────────────────────────
    case "auth/popup-closed-by-user":
      return "The Google sign-in window was closed before completion. Please try again.";

    case "auth/popup-blocked":
      return "The Google sign-in window was blocked by your browser. Please allow popups for this site and try again.";

    case "auth/cancelled-popup-request":
      return "The sign-in request was cancelled. Please try again.";

    // ── Connection / System errors ────────────────────────────────────────
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";

    case "auth/operation-not-allowed":
      return "Email and password sign-in is currently disabled. Please contact support.";

    case "auth/multi-factor-auth-required":
      return "Enter the 6-digit code from your authenticator app.";

    case "auth/invalid-verification-code":
    case "auth/invalid-verification-id":
      return "That verification code is incorrect. Try again.";

    default:
      // Fallback logic
      if (err instanceof Error) {
        if (code) {
          // Format internal codes nicely if we hit an unhandled auth code (e.g. auth/weak-password)
          const cleanCode = code.replace("auth/", "").replace(/-/g, " ");
          return `Authentication failed: ${cleanCode.charAt(0).toUpperCase() + cleanCode.slice(1)}.`;
        }
        return err.message;
      }
      return "An unexpected error occurred. Please try again.";
  }
}
