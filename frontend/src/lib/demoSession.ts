/**
 * DemoSession — tracks which demo user is currently "logged in".
 *
 * Because this app uses demo credentials rather than real Nhost JWTs, the
 * Apollo client cannot obtain an access-token automatically.  We therefore
 * store the demo user's identity in localStorage so we can:
 *
 *  1. Scope GET_USER_ORGS to only the memberships belonging to this user.
 *  2. Perform an explicit page-level org-isolation check without relying on
 *     Hasura RLS (which is bypassed when the admin-secret header is present).
 *
 * In a production deployment the admin-secret fallback in apollo.ts would be
 * removed entirely and replaced with a real Nhost JWT Bearer token obtained
 * via signInEmailPassword().
 */

export interface DemoSession {
  userId: string;
  userEmail: string;
  /** The org this user primarily belongs to (used for isolation checks). */
  orgId: string;
  role: string;
}

/** Canonical map of demo credentials → identity. Keep in sync with DB seed. */
const DEMO_USER_MAP: Record<string, DemoSession> = {
  'owner-orga@example.com': {
    userId: 'aba1cfb2-3348-495a-9268-ac304fc0de0a',
    userEmail: 'owner-orga@example.com',
    orgId: 'b9d07850-e714-4d16-a2aa-0a4343f6a937',
    role: 'owner',
  },
  'editor-orga@example.com': {
    userId: '025899d5-2968-4740-aded-36dafda6fcf0',
    userEmail: 'editor-orga@example.com',
    orgId: 'b9d07850-e714-4d16-a2aa-0a4343f6a937',
    role: 'editor',
  },
  'owner-orgb@example.com': {
    userId: 'bc162e09-b10d-44ea-9734-1a2a066fe5a3',
    userEmail: 'owner-orgb@example.com',
    orgId: '7f18f670-cc04-42b3-b01c-515629a674e9',
    role: 'owner',
  },
  'viewer-orgb@example.com': {
    userId: '87931b68-2244-4288-bc5f-3c35843306c5',
    userEmail: 'viewer-orgb@example.com',
    orgId: '7f18f670-cc04-42b3-b01c-515629a674e9',
    role: 'viewer',
  },
};

const STORAGE_KEY = 'flowmind_demo_session';

export function setDemoSession(email: string): void {
  if (typeof window === 'undefined') return;
  const session = DEMO_USER_MAP[email.toLowerCase()];
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

export function getDemoSession(): DemoSession {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoSession;
        if (parsed && parsed.userId) return parsed;
      }
    } catch {}

    const path = window.location.pathname;
    if (path.includes('7f18f670-cc04-42b3-b01c-515629a674e9')) {
      return DEMO_USER_MAP['owner-orgb@example.com'];
    }
  }
  return DEMO_USER_MAP['owner-orga@example.com'];
}

export function clearDemoSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
