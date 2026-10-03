export type RestaurantOfferConfig = {
  active: boolean;
  bannerText: string;
  badge?: string;
  headline?: string;
  description?: string;
  bannerUrl?: string | null;
  buttonText?: string;
  showOnTableScan?: boolean;
  couponCode?: string;
  discountPercent: number;
  minOrderValue: number;
  bounceBackReward: string;
  bounceBackCode: string;
  referralDiscount: string;
  validityDays?: number;
};

export const DEFAULT_OFFER_CONFIG: RestaurantOfferConfig = {
  active: true,
  bannerText: "FLAT 20% OFF TODAY · Auto-applied on orders above ₹399",
  badge: "TODAY'S SPECIAL",
  headline: "Flat 20% OFF on Orders Above ₹399!",
  description: "Exclusive dine-in special treat. Discount automatically applied at checkout.",
  bannerUrl: null,
  buttonText: "Claim Offer & View Menu 🎉",
  showOnTableScan: true,
  couponCode: "FLAT20",
  discountPercent: 20,
  minOrderValue: 399,
  bounceBackReward: "₹100 OFF on your next visit (Min order ₹499)",
  bounceBackCode: "REPEAT100",
  referralDiscount: "15% OFF for your friends",
  validityDays: 15,
};

export type RestaurantThemeType = "amber" | "crimson" | "saffron" | "emerald" | "charcoal";

export type RestaurantBrandingConfig = {
  theme: RestaurantThemeType;
  logoUrl?: string | null;
  tagline?: string | null;
};

export const DEFAULT_BRANDING_CONFIG: RestaurantBrandingConfig = {
  theme: "amber",
  logoUrl: null,
  tagline: null,
};

export type UpsellStrategy = "smart_ai" | "bestsellers" | "high_margin" | "budget_addons";

export type SmartUpsellConfig = {
  enabled: boolean;
  headline: string;
  strategy: UpsellStrategy;
  maxItems: number;
  pushBeveragesWithStarters: boolean;
  pushDessertsNearCheckout: boolean;
  showSpendGoalNudge: boolean;
  ownerCanManageUpsell?: boolean; // Granted by Super Admin to Restaurant Owner
};

export const DEFAULT_UPSELL_CONFIG: SmartUpsellConfig = {
  enabled: true,
  headline: "Pair With Your Order · Chef's Match",
  strategy: "smart_ai",
  maxItems: 4,
  pushBeveragesWithStarters: true,
  pushDessertsNearCheckout: true,
  showSpendGoalNudge: true,
  ownerCanManageUpsell: true,
};

