export type RolePermissionModules = {
  canAccessFloor: boolean;
  canAccessOrders: boolean;
  canAccessKitchen: boolean;
  canAccessMenu: boolean;
  canAccessInvoices: boolean;
  canAccessStaff: boolean;
  canAccessSettings: boolean;
};

export type RolePermissionsConfig = Record<string, RolePermissionModules>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsConfig = {
  owner: {
    canAccessFloor: true,
    canAccessOrders: true,
    canAccessKitchen: true,
    canAccessMenu: true,
    canAccessInvoices: true,
    canAccessStaff: true,
    canAccessSettings: true,
  },
  manager: {
    canAccessFloor: true,
    canAccessOrders: true,
    canAccessKitchen: true,
    canAccessMenu: true,
    canAccessInvoices: true,
    canAccessStaff: true,
    canAccessSettings: false,
  },
  captain: {
    canAccessFloor: true,
    canAccessOrders: true,
    canAccessKitchen: true,
    canAccessMenu: false,
    canAccessInvoices: false,
    canAccessStaff: false,
    canAccessSettings: false,
  },
  waiter: {
    canAccessFloor: true,
    canAccessOrders: true,
    canAccessKitchen: false,
    canAccessMenu: false,
    canAccessInvoices: false,
    canAccessStaff: false,
    canAccessSettings: false,
  },
  kitchen: {
    canAccessFloor: false,
    canAccessOrders: false,
    canAccessKitchen: true,
    canAccessMenu: false,
    canAccessInvoices: false,
    canAccessStaff: false,
    canAccessSettings: false,
  },
  cashier: {
    canAccessFloor: false,
    canAccessOrders: true,
    canAccessKitchen: false,
    canAccessMenu: false,
    canAccessInvoices: true,
    canAccessStaff: false,
    canAccessSettings: false,
  },
};
