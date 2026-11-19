// Owner gate: first-party (developer-key) MuAPI data must never be exposed to other users.
export const OWNER_EMAIL = (process.env.OWNER_EMAIL || "").trim().toLowerCase();

export function isOwner(email) {
  if (!OWNER_EMAIL) return false;
  return String(email || "").trim().toLowerCase() === OWNER_EMAIL;
}
