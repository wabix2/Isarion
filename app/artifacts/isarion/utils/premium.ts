import { Platform } from "react-native";
import type {
  default as PurchasesType,
  CustomerInfo,
  PurchasesPackage,
  PurchasesOffering,
} from "react-native-purchases";

// Keys come from environment variables — never hardcode in source
const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";
const REVENUECAT_APPLE_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ??
  process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ??
  "";

export const ENTITLEMENT_ID = "lumiq_ai_pro";

let initialized = false;

// react-native-purchases pulls in a native module. Previously this was a
// static top-level `import`, which meant Expo Router's eager route-tree
// loading required it (and touched its native side) on EVERY cold start —
// including for users who never open the paywall — because chat.tsx and
// profile.tsx (which render PremiumPaywallModal) get imported as soon as
// the (tabs) group mounts, not lazily on navigation.
//
// Loading it lazily here means the native module is only required the
// first time initializePurchases() actually runs (i.e. when the paywall
// modal is opened), removing RevenueCat entirely from the guaranteed
// startup path. The dynamic import + try/catch also means a broken/absent
// native module surfaces as a caught JS error instead of crashing import
// resolution for the whole app.
let purchasesModulePromise: Promise<typeof PurchasesType | null> | null = null;
async function getPurchases(): Promise<typeof PurchasesType | null> {
  if (Platform.OS === "web") return null;
  if (!purchasesModulePromise) {
    purchasesModulePromise = import("react-native-purchases")
      .then((mod) => mod.default)
      .catch((e) => {
        console.warn("[RevenueCat] Native module failed to load:", e);
        return null;
      });
  }
  return purchasesModulePromise;
}

export async function initializePurchases(): Promise<void> {
  if (Platform.OS === "web") return;
  if (initialized) return;
  const apiKey =
    Platform.OS === "android" ? REVENUECAT_ANDROID_API_KEY : REVENUECAT_APPLE_API_KEY;
  if (!apiKey) {
    console.warn("[RevenueCat] API key not configured — purchases unavailable");
    return;
  }
  try {
    const [Purchases, { LOG_LEVEL }] = await Promise.all([
      getPurchases(),
      import("react-native-purchases"),
    ]);
    if (!Purchases) return;
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey });
    initialized = true;
  } catch (e) {
    console.warn("[RevenueCat] Failed to initialize:", e);
  }
}

export function isPurchasesInitialized(): boolean {
  return initialized;
}

export async function isPremiumUser(): Promise<boolean> {
  if (Platform.OS === "web" || !initialized) return false;
  try {
    const Purchases = await getPurchases();
    if (!Purchases) return false;
    const info = await Purchases.getCustomerInfo();
    return isEntitlementActive(info);
  } catch {
    return false;
  }
}

function isEntitlementActive(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
}

export interface IsarionOffering {
  monthly:  PurchasesPackage | null;
  yearly:   PurchasesPackage | null;
  lifetime: PurchasesPackage | null;
  raw:      PurchasesOffering | null;
}

export async function getOffering(): Promise<IsarionOffering> {
  const empty: IsarionOffering = { monthly: null, yearly: null, lifetime: null, raw: null };
  if (Platform.OS === "web" || !initialized) return empty;
  try {
    const [Purchases, { PACKAGE_TYPE }] = await Promise.all([
      getPurchases(),
      import("react-native-purchases"),
    ]);
    if (!Purchases) return empty;
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return empty;

    let monthly:  PurchasesPackage | null = null;
    let yearly:   PurchasesPackage | null = null;
    let lifetime: PurchasesPackage | null = null;

    for (const pkg of current.availablePackages) {
      if (pkg.packageType === PACKAGE_TYPE.MONTHLY)  monthly  = pkg;
      if (pkg.packageType === PACKAGE_TYPE.ANNUAL)   yearly   = pkg;
      if (pkg.packageType === PACKAGE_TYPE.LIFETIME) lifetime = pkg;
    }

    // Fallback: match by product identifier if package types are not set
    if (!monthly || !yearly || !lifetime) {
      for (const pkg of current.availablePackages) {
        const id = pkg.product.identifier.toLowerCase();
        if (!monthly  && id.includes("monthly"))  monthly  = pkg;
        if (!yearly   && (id.includes("yearly") || id.includes("annual"))) yearly = pkg;
        if (!lifetime && id.includes("lifetime")) lifetime = pkg;
      }
    }

    return { monthly, yearly, lifetime, raw: current };
  } catch (e) {
    console.warn("[RevenueCat] getOffering failed:", e);
    return empty;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  if (Platform.OS === "web" || !initialized) return false;
  try {
    const Purchases = await getPurchases();
    if (!Purchases) return false;
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return isEntitlementActive(customerInfo);
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (Platform.OS === "web" || !initialized) return false;
  try {
    const Purchases = await getPurchases();
    if (!Purchases) return false;
    const info = await Purchases.restorePurchases();
    return isEntitlementActive(info);
  } catch {
    return false;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (Platform.OS === "web" || !initialized) return null;
  try {
    const Purchases = await getPurchases();
    if (!Purchases) return null;
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export async function logInUser(userId: string): Promise<void> {
  if (Platform.OS === "web" || !initialized) return;
  try {
    const Purchases = await getPurchases();
    if (!Purchases) return;
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn("[RevenueCat] logIn failed:", e);
  }
}

export async function logOutUser(): Promise<void> {
  if (Platform.OS === "web" || !initialized) return;
  try {
    const Purchases = await getPurchases();
    if (!Purchases) return;
    await Purchases.logOut();
  } catch (e) {
    console.warn("[RevenueCat] logOut failed:", e);
  }
}

// Legacy alias — keeps older call sites working
export async function purchasePremium(): Promise<boolean> {
  const offering = await getOffering();
  const pkg = offering.monthly ?? offering.yearly ?? offering.lifetime;
  if (!pkg) return false;
  return purchasePackage(pkg);
}
