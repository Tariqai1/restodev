export type RestaurantFeatures = {
  callWaiter: boolean;        // 🛎️ Staff buzzer module
  prepTimeTracker: boolean;   // ⏳ Live countdown timer & chef/waiter time setter
  customRequests: boolean;    // 🥄 Cutlery, dips, baby chair, custom notes
  tablePayUpi: boolean;       // 💳 Direct UPI QR settlement at table
  dishNotes: boolean;         // ✏️ Special cooking instructions per dish
  smartUpsell: boolean;       // 💡 Smart pairing recommendations in cart
  feedbackReview: boolean;    // ⭐ 5-star Google review booster
  loyaltyOffers?: boolean;    // 🎁 Dynamic discount banner, scratch card & referrals
  waiterOrderApproval?: boolean; // 👨‍💼 Captain/waiter verification required before kitchen dispatch
  quickAdds?: boolean;           // ⚡ 1-Tap fast adds strip for rotis, beverages & extras (Default: false)
  showTableFooter?: boolean;     // 📄 Table Page Footer showing restaurant info & legal (Default: false)
  halfFullPortions?: boolean;    // ⚖️ Half & Full portion selector (Default: true)
  persistentAlarm?: boolean;     // 🚨 Swiggy/Zomato style repeating acoustic alarm until acknowledged
  alarmEscalationSec?: number;   // ⏱️ Seconds before escalating to Manager (Default: 90)
  whatsappAlerts?: boolean;      // 📱 Automated WhatsApp Captain / Group Dispatch
  whatsappCaptainPhone?: string; // Recipient Phone or WhatsApp group number (e.g. 919876543210)
  whatsappWebhookUrl?: string;   // Optional custom WhatsApp/Webhook gateway URL
  mobileNavStyle?: "bottom_bar" | "sidebar"; // 📱 Mobile Navigation Style (Default: 'bottom_bar')
  mobileSheetModals?: boolean; // 📲 Native Bottom Sheet Drawers for mobile forms (Default: true)
  autoMobileCards?: boolean;  // 🖼️ Auto-switch from dense tables to touch cards on mobile (Default: true)
  orderJourneyLayout?: "floating_capsule" | "split_card" | "slim_accordion"; // 🗺️ Customer live order journey UX layout
  onlineOrdering?: boolean; // 🛵 Online Ordering (Delivery & Pickup without table QR)
  // 🤖 NVIDIA NIM AI Powered Capabilities
  aiWaiter?: boolean;        // 🤖 Smart AI Waiter / Dish Recommendation (Llama-3.3-70B)
  aiKitchenPrep?: boolean;   // ⏱️ Smart AI Kitchen Prep Time Estimation (Nemotron)
  aiVoiceOrder?: boolean;    // 🎙️ Voice Ordering (Mic tap to auto-fill cart)
  aiMenuDigitizer?: boolean; // 📸 Menu Digitization (Upload menu photo to auto-create categories & dishes)
};

export const DEFAULT_RESTAURANT_FEATURES: RestaurantFeatures = {
  callWaiter: true,
  prepTimeTracker: true,
  customRequests: true,
  tablePayUpi: true,
  dishNotes: true,
  smartUpsell: true,
  feedbackReview: true,
  loyaltyOffers: true,
  waiterOrderApproval: true,
  quickAdds: false,
  showTableFooter: false,
  halfFullPortions: true,
  persistentAlarm: true,
  alarmEscalationSec: 90,
  whatsappAlerts: false,
  whatsappCaptainPhone: "",
  whatsappWebhookUrl: "",
  mobileNavStyle: "bottom_bar",
  mobileSheetModals: true,
  autoMobileCards: true,
  orderJourneyLayout: "floating_capsule",
  onlineOrdering: false,
  aiWaiter: true,
  aiKitchenPrep: true,
  aiVoiceOrder: true,
  aiMenuDigitizer: true,
};
