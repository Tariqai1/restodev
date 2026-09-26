import {
  RestaurantThemeType,
  RestaurantBrandingConfig,
  RestaurantOfferConfig,
  SmartUpsellConfig,
} from "@/lib/types/offers";

export type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  is_bestseller: boolean;
  has_half_portion?: boolean;
  photo_url: string | null;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
};

export type ActiveOrderItem = {
  id: string;
  menu_item_id?: string;
  qty: number;
  unit_price: number;
  notes: string | null;
  item_status: "pending" | "preparing" | "served";
  customer_name?: string | null;
  menu_items?: {
    name: string;
    is_veg: boolean;
  };
};

export type ActiveOrder = {
  id: string;
  status: string;
  opened_at: string;
  prepEstimate?: {
    orderId: string;
    minutes: number;
    setAt: string;
    setBy: string;
  } | null;
  order_items: ActiveOrderItem[];
};

export type RestaurantFeatures = {
  callWaiter: boolean;
  prepTimeTracker: boolean;
  customRequests: boolean;
  tablePayUpi: boolean;
  dishNotes: boolean;
  smartUpsell: boolean;
  feedbackReview: boolean;
  loyaltyOffers?: boolean;
  waiterOrderApproval?: boolean;
  quickAdds?: boolean;
  showTableFooter?: boolean;
  halfFullPortions?: boolean;
  orderJourneyLayout?: "floating_capsule" | "split_card" | "slim_accordion";
};

export type PortionType = "full" | "half";

export type CartItem = {
  dishId?: string;
  portion?: PortionType;
  qty: number;
  notes: string;
  addedBy: string;
};

export type CartMap = {
  [id: string]: CartItem;
};

export type FlyingParticle = {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  emoji: string;
};

export type WaiterCallType = "waiter" | "water" | "bill" | "clean" | "cutlery" | "condiments" | "chair" | "ac" | "custom";

export type OrderStage = "placed" | "preparing" | "served";

export type ScoredUpsell = {
  id: string;
  name: string;
  price: number;
  is_veg: boolean;
  photo_url: string | null;
  reasonTag: string;
  reasonIcon: string;
  score?: number;
};
