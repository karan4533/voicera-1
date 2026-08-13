export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function sanitizePlainText(input: string, max = 200): string {
  return input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function passwordMeetsPolicy(password: string): boolean {
  return password.length >= 12 && /[A-Za-z]/.test(password) && /\d/.test(password);
}
