// Type shim for @clerk/expo subpath exports that aren't resolved under
// "moduleResolution": "node" (which doesn't read package.json exports maps).

declare module "@clerk/expo/dist/token-cache" {
  import type { TokenCache } from "@clerk/expo";
  /** Expo SecureStore-backed Clerk token cache. */
  export const tokenCache: TokenCache;
}
