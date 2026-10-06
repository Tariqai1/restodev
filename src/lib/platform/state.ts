import fs from "fs";
import path from "path";

export type BroadcastType = "info" | "warning" | "alert" | "maintenance";

export type BroadcastBanner = {
  id: string;
  title: string;
  message: string;
  type: BroadcastType;
  active: boolean;
  dismissible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SuperAdminAction =
  | "ONBOARD"
  | "PLAN_CHANGE"
  | "STATUS_CHANGE"
  | "ARCHIVE"
  | "RESTORE"
  | "DELETE"
  | "RESET_CREDENTIALS"
  | "IMPERSONATE"
  | "BROADCAST_UPDATE";

export type SuperAdminActivityItem = {
  id: string;
  action: SuperAdminAction;
  actorEmail: string;
  targetId?: string;
  targetName?: string;
  details: string;
  createdAt: string;
};

export type ArchivedRestaurantRecord = {
  id: string;
  name: string;
  archivedAt: string;
  archivedBy: string;
  reason?: string;
};

export type StaffOrderPermissions = {
  canEditOrders: boolean;
  canDeleteOrders: boolean;
  assignedPin?: string;
  phone?: string;
  assignedRole?: string;
};

import {
  type RolePermissionModules,
  type RolePermissionsConfig,
  DEFAULT_ROLE_PERMISSIONS,
} from "@/lib/types/roles";

export type { RolePermissionModules, RolePermissionsConfig };
export { DEFAULT_ROLE_PERMISSIONS };

export type WaiterCallType = "waiter" | "water" | "bill" | "clean" | "cutlery" | "condiments" | "chair" | "ac" | "custom";

export type WaiterCallRequest = {
  id: string;
  tableId: string;
  tableNumber: string;
  restaurantId: string;
  type: WaiterCallType;
  customNote?: string;
  paymentMode?: "upi" | "cash" | "card";
  status: "active" | "acknowledged" | "resolved";
  createdAt: string;
  acknowledgedAt?: string;
};

export type PendingOrderApprovalBatch = {
  id: string;
  orderId: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  customerName?: string | null;
  itemIds: string[];
  totalAmount: number;
  totalItems: number;
  status: "awaiting_approval" | "approved" | "rejected";
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
};

import {
  type RestaurantFeatures,
  DEFAULT_RESTAURANT_FEATURES,
} from "@/lib/types/features";

export {
  type RestaurantFeatures,
  DEFAULT_RESTAURANT_FEATURES,
};

import {
  RestaurantOfferConfig,
  DEFAULT_OFFER_CONFIG,
  RestaurantThemeType,
  RestaurantBrandingConfig,
  DEFAULT_BRANDING_CONFIG,
  SmartUpsellConfig,
  DEFAULT_UPSELL_CONFIG,
  UpsellStrategy,
} from "@/lib/types/offers";
export {
  type RestaurantOfferConfig,
  DEFAULT_OFFER_CONFIG,
  type RestaurantThemeType,
  type RestaurantBrandingConfig,
  DEFAULT_BRANDING_CONFIG,
  type SmartUpsellConfig,
  DEFAULT_UPSELL_CONFIG,
  type UpsellStrategy,
};

export type OrderPrepEstimate = {
  orderId: string;
  minutes: number;
  setAt: string;
  setBy: "chef" | "waiter" | "admin";
};

export type RestaurantThemeConfig = {
  theme: RestaurantThemeType;
  primaryColor?: string;
  darkColor?: string;
};

export type PlatformState = {
  broadcast: BroadcastBanner | null;
  activities: SuperAdminActivityItem[];
  archivedRestaurants: Record<string, ArchivedRestaurantRecord>;
  staffPermissions: Record<string, StaffOrderPermissions>;
  waiterCalls?: WaiterCallRequest[];
  restaurantThemes?: Record<string, RestaurantThemeType>;
  restaurantBrandings?: Record<string, RestaurantBrandingConfig>;
  restaurantFeatures?: Record<string, RestaurantFeatures>;
  restaurantOffers?: Record<string, RestaurantOfferConfig>;
  restaurantUpsellConfigs?: Record<string, SmartUpsellConfig>;
  orderPrepEstimates?: Record<string, OrderPrepEstimate>;
  restaurantPhones?: Record<string, string>;
  dishSpecialTags?: Record<string, string>;
  dishHalfPortions?: Record<string, boolean>;
  dishHalfPrices?: Record<string, number>;
  pendingOrderApprovals?: Record<string, PendingOrderApprovalBatch>;
  rolePermissions?: Record<string, RolePermissionsConfig>;
  cashRegisters?: Record<string, CashRegisterState>;
  gstFilingStatuses?: Record<string, Record<string, "filed" | "due" | "upcoming" | "no_liability">>;
  deliverySettings?: Record<string, DeliverySettings>;
  deliveryRiders?: Record<string, DeliveryRider[]>;
  orderDispatches?: Record<string, OrderDispatchInfo>;
  dishChannelVisibilities?: Record<string, "all" | "online_only" | "dine_in_only">;
  dishGalleryImages?: Record<string, string[]>;
  customerDemands?: Record<string, CustomerDemandItem[]>;
};

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "platform-state.json");

// In-memory fallback
let memoryState: PlatformState = {
  broadcast: {
    id: "bcast-default-1",
    title: "Order Desk System Online",
    message: "All POS terminals and multi-tenant nodes operating normally with realtime synchronization.",
    type: "info",
    active: false,
    dismissible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  activities: [
    {
      id: "act-init-1",
      action: "STATUS_CHANGE",
      actorEmail: "tariqfsd9@gmail.com",
      targetName: "System Fleet",
      details: "Platform Command Deck initialized with active tenant sync",
      createdAt: new Date().toISOString(),
    },
  ],
  archivedRestaurants: {},
  staffPermissions: {},
  waiterCalls: [],
  restaurantThemes: {},
  restaurantBrandings: {},
  restaurantFeatures: {},
  restaurantOffers: {},
  restaurantUpsellConfigs: {},
  orderPrepEstimates: {},
  restaurantPhones: {},
  dishSpecialTags: {},
  dishHalfPortions: {},
  dishHalfPrices: {},
  pendingOrderApprovals: {},
  orderDispatches: {},
  deliverySettings: {},
  deliveryRiders: {},
  customerDemands: {},
  dishChannelVisibilities: {},
  dishGalleryImages: {},
};

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn("[platform-state] Could not create data directory:", err);
  }
}

import { createAdminClient } from "@/lib/supabase/admin";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export async function syncPlatformStateToDb(state: PlatformState): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("platform_state_store")
      .upsert({
        key: "global_platform_state",
        value: state as unknown as JsonValue,
        updated_at: new Date().toISOString(),
      });
  } catch {
    // Non-blocking fallback if DB is not reachable or credentials absent
  }
}

export async function syncPlatformStateFromDb(): Promise<PlatformState> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("platform_state_store")
      .select("value")
      .eq("key", "global_platform_state")
      .maybeSingle();

    if (!error && data?.value) {
      const dbState = data.value as PlatformState;
      memoryState = {
        ...memoryState,
        ...dbState,
      };
      try {
        ensureDataDir();
        fs.writeFileSync(STATE_FILE, JSON.stringify(memoryState, null, 2), "utf-8");
      } catch {}
      return memoryState;
    }
  } catch {
    // Non-blocking fallback
  }
  return getPlatformState();
}

export function getPlatformState(): PlatformState {
  ensureDataDir();
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      memoryState = {
        ...memoryState,
        ...parsed,
        broadcast: parsed.broadcast || null,
        activities: Array.isArray(parsed.activities) ? parsed.activities : [],
        archivedRestaurants: parsed.archivedRestaurants || {},
        staffPermissions: parsed.staffPermissions || {},
        waiterCalls: Array.isArray(parsed.waiterCalls) ? parsed.waiterCalls : [],
        restaurantThemes: parsed.restaurantThemes || {},
        restaurantBrandings: parsed.restaurantBrandings || {},
        restaurantFeatures: parsed.restaurantFeatures || {},
        restaurantOffers: parsed.restaurantOffers || {},
        restaurantUpsellConfigs: parsed.restaurantUpsellConfigs || {},
        orderPrepEstimates: parsed.orderPrepEstimates || {},
        restaurantPhones: parsed.restaurantPhones || {},
        dishSpecialTags: parsed.dishSpecialTags || {},
        dishHalfPortions: parsed.dishHalfPortions || {},
        dishHalfPrices: parsed.dishHalfPrices || {},
        pendingOrderApprovals: parsed.pendingOrderApprovals || {},
        deliverySettings: parsed.deliverySettings || {},
        deliveryRiders: parsed.deliveryRiders || {},
        orderDispatches: parsed.orderDispatches || {},
        customerDemands: parsed.customerDemands || {},
        dishChannelVisibilities: parsed.dishChannelVisibilities || {},
        dishGalleryImages: parsed.dishGalleryImages || {},
      };
    } else {
      savePlatformState(memoryState);
    }
  } catch (err) {
    console.warn("[platform-state] Error reading state file, using memory:", err);
  }
  return memoryState;
}

export function savePlatformState(state: PlatformState): void {
  ensureDataDir();
  memoryState = state;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    // In serverless / read-only filesystem environments, writing to disk might fail.
    // Memory state and Supabase DB sync handle persistence.
  }

  // Background async persistence to database
  try {
    syncPlatformStateToDb(state).catch(() => {});
  } catch {}
}

export function getBroadcast(): BroadcastBanner | null {
  const state = getPlatformState();
  return state.broadcast;
}

export function setBroadcast(
  data: Partial<BroadcastBanner> & { title: string; message: string; type: BroadcastType }
): BroadcastBanner {
  const state = getPlatformState();
  const now = new Date().toISOString();
  const updated: BroadcastBanner = {
    id: state.broadcast?.id || "bcast-" + Date.now().toString(36),
    title: data.title.trim(),
    message: data.message.trim(),
    type: data.type || "info",
    active: data.active !== undefined ? data.active : true,
    dismissible: data.dismissible !== undefined ? data.dismissible : true,
    createdAt: state.broadcast?.createdAt || now,
    updatedAt: now,
  };

  state.broadcast = updated;
  savePlatformState(state);
  return updated;
}

export function clearBroadcast(): void {
  const state = getPlatformState();
  if (state.broadcast) {
    state.broadcast.active = false;
    state.broadcast.updatedAt = new Date().toISOString();
    savePlatformState(state);
  }
}

export function getActivities(limit = 100): SuperAdminActivityItem[] {
  const state = getPlatformState();
  return [...state.activities]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function logActivity(
  entry: Omit<SuperAdminActivityItem, "id" | "createdAt">
): SuperAdminActivityItem {
  const state = getPlatformState();
  const newActivity: SuperAdminActivityItem = {
    ...entry,
    id: "act-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
  };

  // Prepend activity
  state.activities.unshift(newActivity);
  // Cap history at 500 records
  if (state.activities.length > 500) {
    state.activities = state.activities.slice(0, 500);
  }

  savePlatformState(state);
  return newActivity;
}

export function isRestaurantArchived(restaurantId: string): boolean {
  const state = getPlatformState();
  return Boolean(state.archivedRestaurants[restaurantId]);
}

export function archiveRestaurant(record: ArchivedRestaurantRecord): void {
  const state = getPlatformState();
  state.archivedRestaurants[record.id] = record;
  savePlatformState(state);
}

export function restoreRestaurant(restaurantId: string): void {
  const state = getPlatformState();
  delete state.archivedRestaurants[restaurantId];
  savePlatformState(state);
}

export function getStaffPermissions(staffId: string, role?: string): StaffOrderPermissions {
  const state = getPlatformState();
  if (state.staffPermissions && state.staffPermissions[staffId]) {
    return state.staffPermissions[staffId];
  }

  // Default permissions based on role
  const r = (role || "waiter").toLowerCase();
  if (r === "owner" || r === "manager" || r === "admin") {
    return { canEditOrders: true, canDeleteOrders: true };
  }
  if (r === "captain") {
    return { canEditOrders: true, canDeleteOrders: false };
  }
  // Waiter, cashier, kitchen default
  return { canEditOrders: false, canDeleteOrders: false };
}

export function setStaffPermissions(
  staffId: string,
  permissions: Partial<StaffOrderPermissions>,
  role?: string
): StaffOrderPermissions {
  const state = getPlatformState();
  if (!state.staffPermissions) {
    state.staffPermissions = {};
  }
  const current = getStaffPermissions(staffId, role);
  state.staffPermissions[staffId] = {
    canEditOrders: permissions.canEditOrders !== undefined ? Boolean(permissions.canEditOrders) : current.canEditOrders,
    canDeleteOrders: permissions.canDeleteOrders !== undefined ? Boolean(permissions.canDeleteOrders) : current.canDeleteOrders,
    assignedPin: permissions.assignedPin !== undefined ? permissions.assignedPin : current.assignedPin,
    phone: permissions.phone !== undefined ? permissions.phone : current.phone,
    assignedRole: permissions.assignedRole !== undefined ? permissions.assignedRole : current.assignedRole,
  };
  savePlatformState(state);
  return state.staffPermissions[staffId];
}

export function getRolePermissions(restaurantId?: string): RolePermissionsConfig {
  const state = getPlatformState();
  const restoId = restaurantId || "default";
  if (state.rolePermissions && state.rolePermissions[restoId]) {
    return {
      ...DEFAULT_ROLE_PERMISSIONS,
      ...state.rolePermissions[restoId],
    };
  }
  return DEFAULT_ROLE_PERMISSIONS;
}

export function saveAllRolePermissions(
  restaurantId: string,
  config: RolePermissionsConfig
): RolePermissionsConfig {
  const state = getPlatformState();
  if (!state.rolePermissions) {
    state.rolePermissions = {};
  }
  state.rolePermissions[restaurantId || "default"] = config;
  savePlatformState(state);
  return config;
}

export function getActiveWaiterCalls(restaurantId?: string): WaiterCallRequest[] {
  const state = getPlatformState();
  const staleBefore = Date.now() - 2 * 60 * 60 * 1000;
  let changed = false;
  const list = (state.waiterCalls || []).map((call) => {
    if (call.status === "active" && new Date(call.createdAt).getTime() < staleBefore) {
      changed = true;
      return { ...call, status: "resolved" as const, acknowledgedAt: new Date().toISOString() };
    }
    return call;
  });
  if (changed) {
    state.waiterCalls = list;
    savePlatformState(state);
  }
  if (!restaurantId) return list.filter((c) => c.status === "active");
  return list.filter((c) => c.restaurantId === restaurantId && c.status === "active");
}

export function createWaiterCall(call: {
  tableId: string;
  tableNumber: string;
  restaurantId: string;
  type: WaiterCallType;
  customNote?: string;
  paymentMode?: "upi" | "cash" | "card";
}): WaiterCallRequest {
  const state = getPlatformState();
  if (!state.waiterCalls) state.waiterCalls = [];

  // Check if active call already exists for same table & type within last 2 minutes
  const existing = state.waiterCalls.find(
    (c) => c.tableId === call.tableId && c.type === call.type && c.status === "active"
  );
  if (existing) return existing;

  const newCall: WaiterCallRequest = {
    id: "call-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
    tableId: call.tableId,
    tableNumber: call.tableNumber,
    restaurantId: call.restaurantId,
    type: call.type,
    customNote: call.customNote,
    paymentMode: call.paymentMode,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  state.waiterCalls.unshift(newCall);
  if (state.waiterCalls.length > 100) {
    state.waiterCalls = state.waiterCalls.slice(0, 100);
  }
  savePlatformState(state);
  return newCall;
}

export function resolveWaiterCall(callId: string): boolean {
  const state = getPlatformState();
  if (!state.waiterCalls) return false;
  const target = state.waiterCalls.find((c) => c.id === callId);
  if (target) {
    target.status = "resolved";
    target.acknowledgedAt = new Date().toISOString();
    savePlatformState(state);
    return true;
  }
  return false;
}

export function getRestaurantTheme(restaurantId?: string): RestaurantThemeType {
  if (!restaurantId) return "amber";
  const state = getPlatformState();
  if (state.restaurantThemes && state.restaurantThemes[restaurantId]) {
    return state.restaurantThemes[restaurantId];
  }
  return "amber";
}

export function setRestaurantTheme(restaurantId: string, theme: RestaurantThemeType): RestaurantThemeType {
  const state = getPlatformState();
  if (!state.restaurantThemes) {
    state.restaurantThemes = {};
  }
  state.restaurantThemes[restaurantId] = theme;
  savePlatformState(state);
  return theme;
}

export function getRestaurantBranding(restaurantId?: string): RestaurantBrandingConfig {
  if (!restaurantId) return { ...DEFAULT_BRANDING_CONFIG };
  const state = getPlatformState();
  const theme = getRestaurantTheme(restaurantId);
  if (state.restaurantBrandings && state.restaurantBrandings[restaurantId]) {
    return { ...DEFAULT_BRANDING_CONFIG, ...state.restaurantBrandings[restaurantId], theme };
  }
  return { ...DEFAULT_BRANDING_CONFIG, theme };
}

export function setRestaurantBranding(
  restaurantId: string,
  branding: Partial<RestaurantBrandingConfig>
): RestaurantBrandingConfig {
  const state = getPlatformState();
  if (!state.restaurantBrandings) {
    state.restaurantBrandings = {};
  }
  const current = getRestaurantBranding(restaurantId);
  const updated: RestaurantBrandingConfig = { ...current, ...branding };
  state.restaurantBrandings[restaurantId] = updated;
  if (branding.theme) {
    setRestaurantTheme(restaurantId, branding.theme);
  }
  savePlatformState(state);
  return updated;
}


export function getRestaurantFeatures(restaurantId?: string): RestaurantFeatures {
  if (!restaurantId) return { ...DEFAULT_RESTAURANT_FEATURES };
  const state = getPlatformState();
  if (state.restaurantFeatures && state.restaurantFeatures[restaurantId]) {
    return { ...DEFAULT_RESTAURANT_FEATURES, ...state.restaurantFeatures[restaurantId] };
  }
  return { ...DEFAULT_RESTAURANT_FEATURES };
}

export function setRestaurantFeatures(restaurantId: string, features: Partial<RestaurantFeatures>): RestaurantFeatures {
  const state = getPlatformState();
  if (!state.restaurantFeatures) {
    state.restaurantFeatures = {};
  }
  const current = state.restaurantFeatures[restaurantId] || { ...DEFAULT_RESTAURANT_FEATURES };
  const updated: RestaurantFeatures = { ...current, ...features };
  state.restaurantFeatures[restaurantId] = updated;
  savePlatformState(state);
  return updated;
}

export function getRestaurantOfferConfig(restaurantId?: string): RestaurantOfferConfig {
  if (!restaurantId) return { ...DEFAULT_OFFER_CONFIG };
  const state = getPlatformState();
  if (state.restaurantOffers && state.restaurantOffers[restaurantId]) {
    return { ...DEFAULT_OFFER_CONFIG, ...state.restaurantOffers[restaurantId] };
  }
  return { ...DEFAULT_OFFER_CONFIG };
}

export function setRestaurantOfferConfig(
  restaurantId: string,
  config: Partial<RestaurantOfferConfig>
): RestaurantOfferConfig {
  const state = getPlatformState();
  if (!state.restaurantOffers) {
    state.restaurantOffers = {};
  }
  const current = state.restaurantOffers[restaurantId] || { ...DEFAULT_OFFER_CONFIG };
  const updated: RestaurantOfferConfig = { ...current, ...config };
  state.restaurantOffers[restaurantId] = updated;
  savePlatformState(state);
  return updated;
}

export function getRestaurantUpsellConfig(restaurantId?: string): SmartUpsellConfig {
  if (!restaurantId) return { ...DEFAULT_UPSELL_CONFIG };
  const state = getPlatformState();
  if (state.restaurantUpsellConfigs && state.restaurantUpsellConfigs[restaurantId]) {
    return { ...DEFAULT_UPSELL_CONFIG, ...state.restaurantUpsellConfigs[restaurantId] };
  }
  return { ...DEFAULT_UPSELL_CONFIG };
}

export function setRestaurantUpsellConfig(
  restaurantId: string,
  config: Partial<SmartUpsellConfig>
): SmartUpsellConfig {
  const state = getPlatformState();
  if (!state.restaurantUpsellConfigs) {
    state.restaurantUpsellConfigs = {};
  }
  const current = state.restaurantUpsellConfigs[restaurantId] || { ...DEFAULT_UPSELL_CONFIG };
  const updated: SmartUpsellConfig = { ...current, ...config };
  state.restaurantUpsellConfigs[restaurantId] = updated;
  // Also sync the features.smartUpsell boolean flag
  if (config.enabled !== undefined) {
    setRestaurantFeatures(restaurantId, { smartUpsell: config.enabled });
  }
  savePlatformState(state);
  return updated;
}

export function getOrderPrepTime(orderId?: string): OrderPrepEstimate | null {
  if (!orderId) return null;
  const state = getPlatformState();
  if (state.orderPrepEstimates && state.orderPrepEstimates[orderId]) {
    return state.orderPrepEstimates[orderId];
  }
  return null;
}

export function setOrderPrepTime(
  orderId: string,
  minutes: number,
  setBy: "chef" | "waiter" | "admin" = "chef"
): OrderPrepEstimate {
  const state = getPlatformState();
  if (!state.orderPrepEstimates) {
    state.orderPrepEstimates = {};
  }
  const estimate: OrderPrepEstimate = {
    orderId,
    minutes,
    setAt: new Date().toISOString(),
    setBy,
  };
  state.orderPrepEstimates[orderId] = estimate;
  savePlatformState(state);
  return estimate;
}

export function getRestaurantPhone(restaurantId?: string): string | null {
  if (!restaurantId) return null;
  const state = getPlatformState();
  return state.restaurantPhones?.[restaurantId] || null;
}

export function setRestaurantPhone(restaurantId: string, phone: string): string {
  const state = getPlatformState();
  if (!state.restaurantPhones) {
    state.restaurantPhones = {};
  }
  state.restaurantPhones[restaurantId] = phone;
  savePlatformState(state);
  return phone;
}

export function getDishSpecialTag(dishId: string): string | null {
  if (!dishId) return null;
  const state = getPlatformState();
  return state.dishSpecialTags?.[dishId] || null;
}

export function setDishSpecialTag(dishId: string, tag: string | null): void {
  if (!dishId) return;
  const state = getPlatformState();
  if (!state.dishSpecialTags) {
    state.dishSpecialTags = {};
  }
  if (tag && tag.trim()) {
    state.dishSpecialTags[dishId] = tag.trim();
  } else {
    delete state.dishSpecialTags[dishId];
  }
  savePlatformState(state);
}

export function getDishHalfPortion(dishId: string): boolean | null {
  if (!dishId) return null;
  const state = getPlatformState();
  if (state.dishHalfPortions && dishId in state.dishHalfPortions) {
    return Boolean(state.dishHalfPortions[dishId]);
  }
  return null;
}

export function setDishHalfPortion(dishId: string, enabled: boolean): void {
  if (!dishId) return;
  const state = getPlatformState();
  if (!state.dishHalfPortions) {
    state.dishHalfPortions = {};
  }
  state.dishHalfPortions[dishId] = enabled;
  savePlatformState(state);
}

export function getDishHalfPrice(dishId: string): number | null {
  if (!dishId) return null;
  const state = getPlatformState();
  if (state.dishHalfPrices && dishId in state.dishHalfPrices) {
    const val = Number(state.dishHalfPrices[dishId]);
    return !isNaN(val) && val > 0 ? val : null;
  }
  return null;
}

export function setDishHalfPrice(dishId: string, price: number): void {
  if (!dishId) return;
  const state = getPlatformState();
  if (!state.dishHalfPrices) {
    state.dishHalfPrices = {};
  }
  state.dishHalfPrices[dishId] = price;
  savePlatformState(state);
}

export type DishChannelVisibility = "all" | "online_only" | "dine_in_only";

export function getDishChannelVisibility(dishId: string): DishChannelVisibility {
  if (!dishId) return "all";
  const state = getPlatformState();
  if (state.dishChannelVisibilities && dishId in state.dishChannelVisibilities) {
    return state.dishChannelVisibilities[dishId];
  }
  return "all";
}

export function setDishChannelVisibility(dishId: string, channel: DishChannelVisibility): void {
  if (!dishId) return;
  const state = getPlatformState();
  if (!state.dishChannelVisibilities) {
    state.dishChannelVisibilities = {};
  }
  state.dishChannelVisibilities[dishId] = channel;
  savePlatformState(state);
}

export function getDishGalleryImages(dishId: string): string[] {
  if (!dishId) return [];
  const state = getPlatformState();
  if (state.dishGalleryImages && dishId in state.dishGalleryImages) {
    return state.dishGalleryImages[dishId] || [];
  }
  return [];
}

export function setDishGalleryImages(dishId: string, images: string[]): void {
  if (!dishId) return;
  const state = getPlatformState();
  if (!state.dishGalleryImages) {
    state.dishGalleryImages = {};
  }
  state.dishGalleryImages[dishId] = images;
  savePlatformState(state);
}


export function registerPendingOrderBatch(
  batch: Omit<PendingOrderApprovalBatch, "id" | "status" | "createdAt">
): PendingOrderApprovalBatch {
  const state = getPlatformState();
  if (!state.pendingOrderApprovals) {
    state.pendingOrderApprovals = {};
  }
  const id = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const record: PendingOrderApprovalBatch = {
    ...batch,
    id,
    status: "awaiting_approval",
    createdAt: new Date().toISOString(),
  };
  state.pendingOrderApprovals[id] = record;
  savePlatformState(state);
  return record;
}

export function getActivePendingApprovals(restaurantId: string): PendingOrderApprovalBatch[] {
  const state = getPlatformState();
  if (!state.pendingOrderApprovals) return [];
  return Object.values(state.pendingOrderApprovals).filter(
    (b) => b.restaurantId === restaurantId && b.status === "awaiting_approval"
  );
}

export function isTableAwaitingApproval(tableId: string): boolean {
  const state = getPlatformState();
  if (!state.pendingOrderApprovals) return false;
  return Object.values(state.pendingOrderApprovals).some(
    (b) => b.tableId === tableId && b.status === "awaiting_approval"
  );
}

export function getPendingApprovalItemIds(restaurantId: string): Set<string> {
  const activeBatches = getActivePendingApprovals(restaurantId);
  const itemIds = new Set<string>();
  for (const batch of activeBatches) {
    for (const id of batch.itemIds) {
      itemIds.add(id);
    }
  }
  return itemIds;
}

export function approveOrderBatch(batchId: string, approvedBy?: string): PendingOrderApprovalBatch | null {
  const state = getPlatformState();
  if (!state.pendingOrderApprovals || !state.pendingOrderApprovals[batchId]) return null;
  const batch = state.pendingOrderApprovals[batchId];
  batch.status = "approved";
  batch.approvedAt = new Date().toISOString();
  if (approvedBy) batch.approvedBy = approvedBy;
  savePlatformState(state);
  return batch;
}

export function rejectOrderBatch(batchId: string, reason?: string): PendingOrderApprovalBatch | null {
  const state = getPlatformState();
  if (!state.pendingOrderApprovals || !state.pendingOrderApprovals[batchId]) return null;
  const batch = state.pendingOrderApprovals[batchId];
  batch.status = "rejected";
  if (reason) batch.rejectedReason = reason;
  savePlatformState(state);
  return batch;
}

export function removeItemFromPendingBatch(
  itemId: string,
  unitPrice: number,
  qty: number
): boolean {
  const state = getPlatformState();
  if (!state.pendingOrderApprovals) return false;
  let modified = false;

  for (const batch of Object.values(state.pendingOrderApprovals)) {
    if (batch.status === "awaiting_approval" && batch.itemIds.includes(itemId)) {
      batch.itemIds = batch.itemIds.filter((id) => id !== itemId);
      batch.totalAmount = Math.max(0, batch.totalAmount - (unitPrice * qty));
      batch.totalItems = Math.max(0, batch.totalItems - qty);
      modified = true;

      // If all items were removed from this verification batch, mark it rejected/cancelled
      if (batch.itemIds.length === 0) {
        batch.status = "rejected";
        batch.rejectedReason = "All items cancelled by customer before captain verification";
      }
    }
  }

  if (modified) {
    savePlatformState(state);
  }
  return modified;
}

export function updateItemQtyInPendingBatch(
  itemId: string,
  oldQty: number,
  newQty: number,
  unitPrice: number
): boolean {
  const state = getPlatformState();
  if (!state.pendingOrderApprovals) return false;
  let modified = false;
  const diff = newQty - oldQty;

  for (const batch of Object.values(state.pendingOrderApprovals)) {
    if (batch.status === "awaiting_approval" && batch.itemIds.includes(itemId)) {
      batch.totalAmount = Math.max(0, batch.totalAmount + (unitPrice * diff));
      batch.totalItems = Math.max(0, batch.totalItems + diff);
      modified = true;
    }
  }

  if (modified) {
    savePlatformState(state);
  }
  return modified;
}

export interface CashRegisterState {
  openingFloat: number;
  isClosed: boolean;
  closedAt: string | null;
  closedBy?: string | null;
  denominations: {
    d500: number;
    d200: number;
    d100: number;
    d50: number;
    d20: number;
    d10: number;
    coins: number;
  };
  notes?: string;
  updatedAt?: string;
}

export function getCashRegisterState(restaurantId?: string): CashRegisterState {
  const defaultState: CashRegisterState = {
    openingFloat: 0,
    isClosed: false,
    closedAt: null,
    closedBy: null,
    denominations: {
      d500: 0,
      d200: 0,
      d100: 0,
      d50: 0,
      d20: 0,
      d10: 0,
      coins: 0,
    },
    notes: "",
  };
  if (!restaurantId) return defaultState;
  const state = getPlatformState();
  if (state.cashRegisters && state.cashRegisters[restaurantId]) {
    return { ...defaultState, ...state.cashRegisters[restaurantId] };
  }
  return defaultState;
}

export function setCashRegisterState(
  restaurantId: string,
  register: Partial<CashRegisterState>
): CashRegisterState {
  const state = getPlatformState();
  if (!state.cashRegisters) {
    state.cashRegisters = {};
  }
  const current = getCashRegisterState(restaurantId);
  const updated: CashRegisterState = {
    ...current,
    ...register,
    denominations: {
      ...current.denominations,
      ...(register.denominations || {}),
    },
    updatedAt: new Date().toISOString(),
  };
  state.cashRegisters[restaurantId] = updated;
  savePlatformState(state);
  return updated;
}

export type GstFilingStatusValue = "filed" | "due" | "upcoming" | "no_liability";

export function getGstFilingStatuses(restaurantId?: string): Record<string, GstFilingStatusValue> {
  if (!restaurantId) return {};
  const state = getPlatformState();
  return state.gstFilingStatuses?.[restaurantId] || {};
}

export function setGstFilingStatus(
  restaurantId: string,
  monthKey: string,
  status: GstFilingStatusValue
): Record<string, GstFilingStatusValue> {
  const state = getPlatformState();
  if (!state.gstFilingStatuses) {
    state.gstFilingStatuses = {};
  }
  if (!state.gstFilingStatuses[restaurantId]) {
    state.gstFilingStatuses[restaurantId] = {};
  }
  state.gstFilingStatuses[restaurantId][monthKey] = status;
  savePlatformState(state);
  return state.gstFilingStatuses[restaurantId];
}

export type DeliverySettings = {
  restaurantId: string;
  onlineOrderingEnabled: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryFee: number;
  minimumOrderAmount: number;
  estimatedPrepMinutes: number;
  latitude?: number;
  longitude?: number;
  slug?: string;
  updatedAt?: string;
};

export const DEFAULT_DELIVERY_SETTINGS: Omit<DeliverySettings, "restaurantId"> = {
  onlineOrderingEnabled: true,
  pickupEnabled: true,
  deliveryEnabled: true,
  deliveryRadiusKm: 5,
  deliveryFee: 0,
  minimumOrderAmount: 0,
  estimatedPrepMinutes: 25,
  latitude: 19.1918,
  longitude: 73.0229,
  slug: "",
};

export function getDeliverySettings(restaurantId?: string): DeliverySettings {
  const defaults: DeliverySettings = {
    restaurantId: restaurantId || "",
    ...DEFAULT_DELIVERY_SETTINGS,
  };
  if (!restaurantId) return defaults;
  const state = getPlatformState();
  if (state.deliverySettings && state.deliverySettings[restaurantId]) {
    return { ...defaults, ...state.deliverySettings[restaurantId] };
  }
  return defaults;
}

export function setDeliverySettings(
  restaurantId: string,
  settings: Partial<DeliverySettings>
): DeliverySettings {
  const state = getPlatformState();
  if (!state.deliverySettings) {
    state.deliverySettings = {};
  }
  const current = getDeliverySettings(restaurantId);
  const updated: DeliverySettings = {
    ...current,
    ...settings,
    restaurantId,
    updatedAt: new Date().toISOString(),
  };
  state.deliverySettings[restaurantId] = updated;
  savePlatformState(state);
  return updated;
}

// ─────────────────────────────────────────────────────────────
// DELIVERY RIDERS & DISPATCH MANAGEMENT
// ─────────────────────────────────────────────────────────────

export type DeliveryRider = {
  id: string;
  name: string;
  phone: string;
  vehicle?: string;
  active: boolean;
  createdAt?: string;
};

export type OrderDispatchInfo = {
  orderId: string;
  restaurantId?: string;
  riderName?: string;
  riderPhone?: string;
  dispatchedAt?: string;
  stage: "pending" | "dispatched" | "delivered" | "cancelled";
  cancelledReason?: string;
  cancelledBy?: "staff" | "customer";
  cancelledAt?: string;
  deliveredAt?: string;
  verificationCode?: string;
  paymentCollectedMode?: "cash" | "upi";
  cashAmountCollected?: number;
};

export function getDeliveryRiders(restaurantId: string): DeliveryRider[] {
  if (!restaurantId) return [];
  const state = getPlatformState();
  return (state.deliveryRiders && state.deliveryRiders[restaurantId]) || [];
}

export function saveDeliveryRider(
  restaurantId: string,
  rider: Omit<DeliveryRider, "id"> & { id?: string }
): DeliveryRider[] {
  if (!restaurantId) return [];
  const state = getPlatformState();
  if (!state.deliveryRiders) {
    state.deliveryRiders = {};
  }
  const currentList = state.deliveryRiders[restaurantId] || [];
  const riderId = rider.id || `rider_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const existingIdx = currentList.findIndex((r) => r.id === riderId);
  const updatedRider: DeliveryRider = {
    id: riderId,
    name: rider.name.trim(),
    phone: rider.phone.trim(),
    vehicle: rider.vehicle?.trim() || "Bike",
    active: rider.active !== undefined ? rider.active : true,
    createdAt: existingIdx >= 0 ? currentList[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    currentList[existingIdx] = updatedRider;
  } else {
    currentList.push(updatedRider);
  }

  state.deliveryRiders[restaurantId] = currentList;
  savePlatformState(state);
  return currentList;
}

export function deleteDeliveryRider(restaurantId: string, riderId: string): DeliveryRider[] {
  if (!restaurantId) return [];
  const state = getPlatformState();
  if (!state.deliveryRiders || !state.deliveryRiders[restaurantId]) return [];
  state.deliveryRiders[restaurantId] = state.deliveryRiders[restaurantId].filter((r) => r.id !== riderId);
  savePlatformState(state);
  return state.deliveryRiders[restaurantId];
}

export function getOrderDispatch(orderId: string): OrderDispatchInfo | null {
  if (!orderId) return null;
  const state = getPlatformState();
  return (state.orderDispatches && state.orderDispatches[orderId]) || null;
}

export function setOrderDispatch(
  orderId: string,
  info: Partial<OrderDispatchInfo>
): OrderDispatchInfo {
  const state = getPlatformState();
  if (!state.orderDispatches) {
    state.orderDispatches = {};
  }
  const current = getOrderDispatch(orderId) || {
    orderId,
    stage: "pending" as const,
  };
  const updated: OrderDispatchInfo = {
    ...current,
    ...info,
    orderId,
  };
  state.orderDispatches[orderId] = updated;
  savePlatformState(state);
  return updated;
}

export type CustomerDemandItem = {
  id: string;
  restaurantId: string;
  itemName: string;
  categoryHint?: string;
  count: number;
  lastRequestedAt: string;
  firstRequestedAt: string;
  status: "pending" | "added_to_menu" | "dismissed";
};

export function recordCustomerDemand(
  restaurantId: string,
  itemName: string,
  categoryHint?: string
): CustomerDemandItem | null {
  if (!restaurantId || !itemName) return null;
  const cleanItem = itemName.trim().toLowerCase();
  const state = getPlatformState();
  if (!state.customerDemands) {
    state.customerDemands = {};
  }
  if (!state.customerDemands[restaurantId]) {
    state.customerDemands[restaurantId] = [];
  }

  const existing = state.customerDemands[restaurantId].find(
    (d: CustomerDemandItem) => d.itemName.toLowerCase() === cleanItem
  );

  const now = new Date().toISOString();
  if (existing) {
    existing.count += 1;
    existing.lastRequestedAt = now;
    if (categoryHint && !existing.categoryHint) {
      existing.categoryHint = categoryHint;
    }
    savePlatformState(state);
    return existing;
  }

  const newDemand: CustomerDemandItem = {
    id: `dem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    restaurantId,
    itemName: itemName.trim(),
    categoryHint: categoryHint || "Special Request",
    count: 1,
    lastRequestedAt: now,
    firstRequestedAt: now,
    status: "pending",
  };

  state.customerDemands[restaurantId].unshift(newDemand);
  savePlatformState(state);
  return newDemand;
}

export function getCustomerDemands(restaurantId: string): CustomerDemandItem[] {
  if (!restaurantId) return [];
  const state = getPlatformState();
  return (state.customerDemands && state.customerDemands[restaurantId]) || [];
}

export function updateCustomerDemandStatus(
  restaurantId: string,
  demandId: string,
  status: "pending" | "added_to_menu" | "dismissed"
): CustomerDemandItem[] {
  if (!restaurantId || !demandId) return [];
  const state = getPlatformState();
  if (!state.customerDemands || !state.customerDemands[restaurantId]) return [];

  state.customerDemands[restaurantId] = state.customerDemands[restaurantId].map(
    (d: CustomerDemandItem) => (d.id === demandId ? { ...d, status } : d)
  );

  savePlatformState(state);
  return state.customerDemands[restaurantId];
}

export function deleteCustomerDemand(
  restaurantId: string,
  demandId: string
): CustomerDemandItem[] {
  if (!restaurantId || !demandId) return [];
  const state = getPlatformState();
  if (!state.customerDemands || !state.customerDemands[restaurantId]) return [];

  state.customerDemands[restaurantId] = state.customerDemands[restaurantId].filter(
    (d: CustomerDemandItem) => d.id !== demandId
  );

  savePlatformState(state);
  return state.customerDemands[restaurantId];
}


