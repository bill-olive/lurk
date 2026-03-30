/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Firebase client API key (public identifier, not a secret) */
  readonly VITE_FIREBASE_API_KEY: string;
  /** Firebase Auth domain, e.g. lurk-a692c.firebaseapp.com */
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  /** Firebase project ID, e.g. lurk-a692c */
  readonly VITE_FIREBASE_PROJECT_ID: string;
  /** Lurk API Gateway URL, e.g. https://lurk-api-gateway-xxx-uc.a.run.app */
  readonly VITE_LURK_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
