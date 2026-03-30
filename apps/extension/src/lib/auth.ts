// ---------------------------------------------------------------------------
// Auth — Firebase Auth for extension context
// ---------------------------------------------------------------------------

import { chromeStorage } from './storage';

// ---- Types -----------------------------------------------------------------

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  orgId: string | null;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// ---- Constants -------------------------------------------------------------

const AUTH_STORAGE_KEY = 'lurk_auth';

// Injected at build time via Vite define (see vite.config.ts).
// VITE_FIREBASE_API_KEY is the Firebase *client* API key — a public identifier
// that scopes requests to the Firebase project. It is NOT a secret.
// See: https://firebase.google.com/docs/projects/api-keys
const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY ?? '';
const FIREBASE_AUTH_DOMAIN = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'lurk-a692c.firebaseapp.com';

// ---- Auth Manager ----------------------------------------------------------

class AuthManager {
  private currentUser: AuthUser | null = null;
  private listeners: Array<(state: AuthState) => void> = [];

  async initialize(): Promise<AuthState> {
    try {
      const stored = await chromeStorage.get<AuthUser>(AUTH_STORAGE_KEY);
      if (stored && stored.expiresAt > Date.now()) {
        this.currentUser = stored;
        return this.getState();
      }

      if (stored && stored.refreshToken) {
        try {
          const refreshed = await this.refreshToken(stored.refreshToken);
          this.currentUser = refreshed;
          await chromeStorage.set(AUTH_STORAGE_KEY, refreshed);
          return this.getState();
        } catch {
          // Refresh failed, clear auth
          await this.signOut();
        }
      }

      return this.getState();
    } catch (error) {
      console.error('[Lurk Auth] Initialization failed:', error);
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to initialize auth',
      };
    }
  }

  async signInWithGoogle(): Promise<AuthUser> {
    return new Promise((resolve, reject) => {
      const authUrl = new URL(`https://${FIREBASE_AUTH_DOMAIN}/__/auth/handler`);
      authUrl.searchParams.set('apiKey', FIREBASE_API_KEY);
      authUrl.searchParams.set('authType', 'signInViaPopup');
      authUrl.searchParams.set('providerId', 'google.com');

      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true,
        },
        async (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            reject(new Error(chrome.runtime.lastError?.message ?? 'Auth flow cancelled'));
            return;
          }

          try {
            const url = new URL(redirectUrl);
            const idToken = url.searchParams.get('id_token') ?? url.hash.match(/id_token=([^&]+)/)?.[1];

            if (!idToken) {
              reject(new Error('No ID token received'));
              return;
            }

            const user = await this.exchangeToken(idToken);
            this.currentUser = user;
            await chromeStorage.set(AUTH_STORAGE_KEY, user);
            this.notifyListeners();
            resolve(user);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    await chromeStorage.remove(AUTH_STORAGE_KEY);
    this.notifyListeners();
  }

  getUser(): AuthUser | null {
    return this.currentUser;
  }

  getState(): AuthState {
    return {
      user: this.currentUser,
      isAuthenticated: this.currentUser !== null,
      isLoading: false,
      error: null,
    };
  }

  async getToken(): Promise<string | null> {
    if (!this.currentUser) return null;

    // Check if token is expired (with 5 minute buffer)
    if (this.currentUser.expiresAt < Date.now() + 5 * 60 * 1000) {
      try {
        const refreshed = await this.refreshToken(this.currentUser.refreshToken);
        this.currentUser = refreshed;
        await chromeStorage.set(AUTH_STORAGE_KEY, refreshed);
      } catch {
        await this.signOut();
        return null;
      }
    }

    return this.currentUser.token;
  }

  onAuthStateChanged(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  private async exchangeToken(idToken: string): Promise<AuthUser> {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postBody: `id_token=${idToken}&providerId=google.com`,
          requestUri: chrome.runtime.getURL('/'),
          returnIdpCredential: true,
          returnSecureToken: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    const data = await response.json();
    return {
      uid: data.localId,
      email: data.email,
      displayName: data.displayName ?? null,
      photoURL: data.photoUrl ?? null,
      orgId: null, // Fetched from Lurk API after sign-in
      token: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + parseInt(data.expiresIn, 10) * 1000,
    };
  }

  private async refreshToken(refreshToken: string): Promise<AuthUser> {
    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
      }
    );

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    return {
      ...this.currentUser!,
      token: data.id_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + parseInt(data.expires_in, 10) * 1000,
    };
  }
}

export const auth = new AuthManager();
