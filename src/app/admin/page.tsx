"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import AdminSidebar, { AdminViewType } from "@/components/admin/layout/AdminSidebar";
import AdminHeader from "@/components/admin/layout/AdminHeader";
import AdminKPICard from "@/components/admin/ui/AdminKPICard";
import AdminDataTable, { ColumnDef, RowAction } from "@/components/admin/ui/AdminDataTable";
import AdminBadge, { BadgeVariant } from "@/components/admin/ui/AdminBadge";
import AdminButton from "@/components/admin/ui/AdminButton";
import AdminModal from "@/components/admin/ui/AdminModal";
import AdminTableFilters from "@/components/admin/ui/AdminTableFilters";
import dynamic from "next/dynamic";
import {
  RolePermissionsConfig,
  DEFAULT_ROLE_PERMISSIONS,
  RolePermissionModules,
} from "@/lib/types/roles";

const ShareMenuModal = dynamic(() => import("@/components/ShareMenuModal"), {
  ssr: false,
});

const MODULE_DEFS: {
  key: keyof RolePermissionModules;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    key: "canAccessFloor",
    label: "Live Floor & Tables",
    description: "View real-time table occupancy, assign tables, check table status",
    icon: "fa-table-cells",
  },
  {
    key: "canAccessOrders",
    label: "Live Dine-In Orders",
    description: "Punch items, edit running orders, captain approval verification",
    icon: "fa-receipt",
  },
  {
    key: "canAccessKitchen",
    label: "Kitchen KDS Display",
    description: "View kitchen station rail, cook tickets, mark dishes ready",
    icon: "fa-fire-burner",
  },
  {
    key: "canAccessMenu",
    label: "Menu & Dish Catalog",
    description: "Modify dish prices, add new items, 86 / mark dishes stock out",
    icon: "fa-utensils",
  },
  {
    key: "canAccessInvoices",
    label: "Billing & Invoices",
    description: "Generate bills, collect payments, day-end cash register, GST",
    icon: "fa-file-invoice-dollar",
  },
  {
    key: "canAccessStaff",
    label: "Staff Roster & PINs",
    description: "View team roster, assign fast 4-digit PINs, manage shift roles",
    icon: "fa-users-gear",
  },
  {
    key: "canAccessSettings",
    label: "Store Configuration",
    description: "Table QR studio, thermal printer dispatch, restaurant settings",
    icon: "fa-sliders",
  },
];

const ROLES_LIST = ["manager", "captain", "waiter", "kitchen", "cashier"] as const;

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  description?: string;
  has_half_portion?: boolean;
}

interface TableRecord {
  id: string;
  table_number: string;
  status: "available" | "occupied" | "billed";
  qr_token: string;
  current_order_id?: string | null;
  active_bill_amount?: number;
  guest_count?: number;
}

interface OrderRecord {
  id: string;
  table_number: string;
  customer_name?: string;
  item_count: number;
  total_amount: number;
  status: "placed" | "preparing" | "served" | "completed" | "cancelled";
  created_at: string;
  items_summary?: string;
}

interface StaffRecord {
  id: string;
  name: string;
  role: "waiter" | "kitchen" | "captain" | "manager";
  pin: string;
  is_active: boolean;
}

interface InvoiceRecord {
  id: string;
  bill_number: string;
  table_number: string;
  order_id: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_mode: "upi" | "cash" | "card";
  payment_status: "paid" | "unpaid";
  paid_at: string;
}

export default function AdminPage() {
  const [currentView, setCurrentView] = useState<AdminViewType>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Core Data
  const [restaurantName, setRestaurantName] = useState("Restaurant");
  const [ownerEmail, setOwnerEmail] = useState("owner@restaurant.com");
  const [ownerName, setOwnerName] = useState("Restaurant Owner");

  const [tables, setTables] = useState<TableRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modals
  const [isAddDishOpen, setIsAddDishOpen] = useState(false);
  const [newDishName, setNewDishName] = useState("");
  const [newDishCategory, setNewDishCategory] = useState("Main Course");
  const [newDishPrice, setNewDishPrice] = useState("");
  const [newDishIsVeg, setNewDishIsVeg] = useState(true);
  const [newDishDesc, setNewDishDesc] = useState("");

  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"waiter" | "kitchen" | "captain">("waiter");
  const [newStaffPin, setNewStaffPin] = useState("");

  const [selectedQRTable, setSelectedQRTable] = useState<TableRecord | null>(null);

  // Role-Based Access Control State
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsConfig>(DEFAULT_ROLE_PERMISSIONS);
  const [isSavingRoles, setIsSavingRoles] = useState(false);
  const [rolesSaveMessage, setRolesSaveMessage] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("owner");

  // Fetch initial restaurant data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const data = await res.json();
        if (data.restaurant) {
          setRestaurantName(data.restaurant.name || "Restaurant");
          setOwnerEmail(data.restaurant.owner_email || data.user?.email || "owner@restaurant.com");
          setOwnerName(data.restaurant.owner_name || data.user?.name || "Restaurant Owner");
        }

        // Map tables
        if (Array.isArray(data.tables)) {
          setTables(
            data.tables.map((t: any) => ({
              id: t.id,
              table_number: t.table_number || t.name || "T01",
              status: t.is_occupied || t.occupied ? "occupied" : "available",
              qr_token: t.qr_token || "",
              active_bill_amount: t.active_bill_amount || 0,
            }))
          );
        }

        // Map orders
        if (Array.isArray(data.openOrders)) {
          setOrders(
            data.openOrders.map((o: any) => ({
              id: o.id,
              table_number: o.table_number || o.restaurant_tables?.table_number || "T01",
              customer_name: o.customer_name || "Guest",
              item_count: Array.isArray(o.order_items) ? o.order_items.length : 1,
              total_amount: o.order_items
                ? o.order_items.reduce((s: number, it: any) => s + (Number(it.unit_price) * Number(it.qty) || 0), 0)
                : 0,
              status: o.status === "open" ? "preparing" : o.status || "placed",
              created_at: o.opened_at || new Date().toISOString(),
              items_summary: Array.isArray(o.order_items)
                ? o.order_items.map((it: any) => `${it.qty}x ${it.menu_items?.name || "Dish"}`).join(", ")
                : "Assorted dishes",
            }))
          );
        }
      }

      // Fetch Menu
      const menuRes = await fetch("/api/menu");
      if (menuRes.ok) {
        const menuData = await menuRes.json();
        if (Array.isArray(menuData.items)) {
          setMenuItems(
            menuData.items.map((m: any) => ({
              id: m.id,
              name: m.name,
              category: m.menu_categories?.name || m.category || "General",
              price: Number(m.price) || 0,
              is_veg: Boolean(m.is_veg),
              is_available: m.is_available !== false,
              description: m.description,
            }))
          );
        }
        if (Array.isArray(menuData.categories)) {
          setCategories(menuData.categories.map((c: any) => c.name));
        }
      }

      // Fetch Staff
      const staffRes = await fetch("/api/staff");
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        if (Array.isArray(staffData.staff)) {
          setStaffList(
            staffData.staff.map((s: any) => ({
              id: s.id,
              name: s.name,
              role: s.role || "waiter",
              pin: s.pin || "••••",
              is_active: true,
            }))
          );
        }
      }

      // Fetch Role Access Permissions
      try {
        const rolesRes = await fetch("/api/restaurant/roles");
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          if (rolesData.permissions) {
            setRolePermissions(rolesData.permissions);
          }
        }
      } catch {
        // ignore
      }
    } catch {
      // Gracefully fall back to local starter data if fresh
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleToggleRoleModule = (
    roleKey: string,
    moduleKey: keyof RolePermissionModules,
    value: boolean
  ) => {
    setRolePermissions((prev) => ({
      ...prev,
      [roleKey]: {
        ...(prev[roleKey] || DEFAULT_ROLE_PERMISSIONS[roleKey] || {}),
        [moduleKey]: value,
      },
    }));
  };

  const handleSaveRolePermissions = async () => {
    setIsSavingRoles(true);
    setRolesSaveMessage("");
    try {
      const res = await fetch("/api/restaurant/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: rolePermissions }),
      });
      if (res.ok) {
        setRolesSaveMessage("Role access permissions saved and active across all staff terminals!");
        setTimeout(() => setRolesSaveMessage(""), 4000);
      } else {
        setRolesSaveMessage("Failed to save permissions. Verify owner authorization.");
      }
    } catch {
      setRolesSaveMessage("Network error saving permissions.");
    } finally {
      setIsSavingRoles(false);
    }
  };

  const handleResetRoleDefaults = () => {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    setRolesSaveMessage("Reset to recommended operational defaults. Click 'Save Access Matrix' to apply.");
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived KPI Metrics
  const activeTablesCount = tables.filter((t) => t.status === "occupied").length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "available"
          ? item.is_available
          : !item.is_available;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [menuItems, searchQuery, categoryFilter, statusFilter]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const matchesSearch =
        ord.table_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ord.customer_name && ord.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ord.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || ord.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  // Add Dish Action
  const handleCreateDish = () => {
    if (!newDishName.trim() || !newDishPrice) return;
    const newDish: MenuItem = {
      id: `dish-${Date.now()}`,
      name: newDishName.trim(),
      category: newDishCategory,
      price: Number(newDishPrice),
      is_veg: newDishIsVeg,
      is_available: true,
      description: newDishDesc.trim(),
    };
    setMenuItems((prev) => [newDish, ...prev]);
    setIsAddDishOpen(false);
    setNewDishName("");
    setNewDishPrice("");
    setNewDishDesc("");
  };

  // Add Staff Action
  const handleCreateStaff = () => {
    if (!newStaffName.trim() || !newStaffPin) return;
    const newMember: StaffRecord = {
      id: `staff-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole,
      pin: newStaffPin,
      is_active: true,
    };
    setStaffList((prev) => [...prev, newMember]);
    setIsAddStaffOpen(false);
    setNewStaffName("");
    setNewStaffPin("");
  };

  // Toggle Dish Availability (86-List)
  const handleToggleStock = (dishId: string) => {
    setMenuItems((prev) =>
      prev.map((d) => (d.id === dishId ? { ...d, is_available: !d.is_available } : d))
    );
  };

  // Page titles mapping
  const viewTitles: Record<AdminViewType, { title: string; breadcrumb: string[] }> = {
    dashboard: { title: "Executive Dashboard", breadcrumb: ["Admin", "Analytics", "Dashboard"] },
    reports: { title: "Sales & Tax Reports", breadcrumb: ["Admin", "Analytics", "Reports"] },
    analytics: { title: "Dish Performance", breadcrumb: ["Admin", "Analytics", "Performance"] },
    floor: { title: "Live Floor Plan", breadcrumb: ["Admin", "Operations", "Floor Plan"] },
    kitchen: { title: "Kitchen Display (KDS)", breadcrumb: ["Admin", "Operations", "Kitchen"] },
    orders: { title: "Dine-In & Orders", breadcrumb: ["Admin", "Operations", "Orders"] },
    approvals: { title: "Captain Approvals", breadcrumb: ["Admin", "Operations", "Approvals"] },
    menu_items: { title: "Dishes & Modifiers", breadcrumb: ["Admin", "Catalog", "Dishes"] },
    menu_categories: { title: "Menu Categories", breadcrumb: ["Admin", "Catalog", "Categories"] },
    stockout: { title: "86 / Stock Out List", breadcrumb: ["Admin", "Catalog", "Stock Out"] },
    staff: { title: "Staff Roster", breadcrumb: ["Admin", "Staff", "Roster"] },
    roles: { title: "Roles & Permissions", breadcrumb: ["Admin", "Staff", "Roles"] },
    activity: { title: "Audit & Activity Logs", breadcrumb: ["Admin", "Staff", "Activity"] },
    customers: { title: "Customer Directory", breadcrumb: ["Admin", "CRM", "Customers"] },
    support: { title: "Support Cases & Feedback", breadcrumb: ["Admin", "CRM", "Support"] },
    invoices: { title: "Invoices & Receipts", breadcrumb: ["Admin", "Finance", "Invoices"] },
    cash_register: { title: "Day-End Cash Register", breadcrumb: ["Admin", "Finance", "Register"] },
    taxes: { title: "Taxes & Financial Year", breadcrumb: ["Admin", "Finance", "Taxes"] },
    qr_studio: { title: "Table QR Studio", breadcrumb: ["Admin", "Configuration", "QR Studio"] },
    hardware: { title: "Hardware & Printers", breadcrumb: ["Admin", "Configuration", "Hardware"] },
    settings: { title: "Administration & Store", breadcrumb: ["Admin", "Configuration", "Settings"] },
  };

  const currentMeta = viewTitles[currentView] || viewTitles.dashboard;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Fixed Left Sidebar */}
      <AdminSidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((p) => !p)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        restaurantName={restaurantName}
        userRole={currentUserRole}
        rolePermissions={rolePermissions}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        {/* Fixed Top Header */}
        <AdminHeader
          pageTitle={currentMeta.title}
          breadcrumb={currentMeta.breadcrumb}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          userName={ownerName}
          userEmail={ownerEmail}
          restaurantName={restaurantName}
          activeTablesCount={activeTablesCount}
          totalTablesCount={tables.length}
          onQuickAction={() => setIsAddDishOpen(true)}
          onSelectView={setCurrentView}
        />

        {/* View Canvas Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* ======================================================== */}
          {/* VIEW: DASHBOARD */}
          {/* ======================================================== */}
          {currentView === "dashboard" && (
            <div className="space-y-6">
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <AdminKPICard
                  title="Today's Revenue"
                  value={`₹${totalRevenue.toLocaleString("en-IN")}`}
                  change="+14.2%"
                  isPositive={true}
                  subtext="vs yesterday"
                  icon="fa-indian-rupee-sign"
                  iconColor="purple"
                />
                <AdminKPICard
                  title="Total Orders"
                  value={orders.length}
                  change="+8.5%"
                  isPositive={true}
                  subtext="vs yesterday"
                  icon="fa-receipt"
                  iconColor="blue"
                />
                <AdminKPICard
                  title="Active Tables"
                  value={`${activeTablesCount} / ${tables.length}`}
                  subtext="Occupied right now"
                  icon="fa-table-cells"
                  iconColor="emerald"
                />
                <AdminKPICard
                  title="Average Prep"
                  value="14 min"
                  change="-2 min"
                  isPositive={true}
                  subtext="Kitchen velocity"
                  icon="fa-stopwatch"
                  iconColor="amber"
                />
                <AdminKPICard
                  title="Staff On Duty"
                  value={staffList.length}
                  subtext="Active members"
                  icon="fa-users"
                  iconColor="purple"
                />
                <AdminKPICard
                  title="Menu Dishes"
                  value={menuItems.length}
                  subtext="Catalog items"
                  icon="fa-bowl-food"
                  iconColor="rose"
                />
              </div>

              {/* Quick Actions Bar */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                  <span>Restaurant Engine Online · Real-time sync enabled</span>
                </div>
                <div className="flex items-center gap-2">
                  <AdminButton
                    variant="outline"
                    size="sm"
                    leftIcon="fa-table-cells"
                    onClick={() => setCurrentView("floor")}
                  >
                    Floor Plan
                  </AdminButton>
                  <AdminButton
                    variant="outline"
                    size="sm"
                    leftIcon="fa-fire-burner"
                    onClick={() => setCurrentView("kitchen")}
                  >
                    Kitchen KDS
                  </AdminButton>
                  <AdminButton
                    variant="primary"
                    size="sm"
                    leftIcon="fa-plus"
                    onClick={() => setIsAddDishOpen(true)}
                  >
                    Add Dish
                  </AdminButton>
                </div>
              </div>

              {/* Live Floor Overview Grid */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Live Table Status
                    </h3>
                    <p className="text-xs text-slate-500">
                      Real-time dine-in occupancy across all floor zones
                    </p>
                  </div>
                  <AdminButton
                    variant="ghost"
                    size="sm"
                    rightIcon="fa-arrow-right"
                    onClick={() => setCurrentView("floor")}
                  >
                    View All Tables
                  </AdminButton>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {tables.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedQRTable(t);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                        t.status === "occupied"
                          ? "bg-purple-50/60 border-purple-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-800">
                          {t.table_number}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            t.status === "occupied"
                              ? "bg-purple-600 animate-pulse"
                              : "bg-slate-300"
                          }`}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 capitalize">
                        {t.status === "occupied" ? "Occupied" : "Available"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Active Kitchen & Table Orders
                  </h3>
                  <AdminButton
                    variant="ghost"
                    size="sm"
                    rightIcon="fa-arrow-right"
                    onClick={() => setCurrentView("orders")}
                  >
                    View All Orders
                  </AdminButton>
                </div>

                <AdminDataTable<OrderRecord>
                  columns={[
                    {
                      key: "table_number",
                      header: "Table",
                      width: "80px",
                      sortable: true,
                      render: (r) => (
                        <span className="font-bold text-slate-900">
                          {r.table_number}
                        </span>
                      ),
                    },
                    {
                      key: "customer_name",
                      header: "Guest",
                      render: (r) => r.customer_name || "Dine-in Guest",
                    },
                    {
                      key: "items_summary",
                      header: "Dishes Ordered",
                      render: (r) => (
                        <span className="truncate max-w-xs block text-slate-600">
                          {r.items_summary}
                        </span>
                      ),
                    },
                    {
                      key: "total_amount",
                      header: "Total (₹)",
                      align: "right",
                      sortable: true,
                      render: (r) => (
                        <span className="font-mono font-bold text-slate-900">
                          ₹{r.total_amount}
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (r) => {
                        const variant: BadgeVariant =
                          r.status === "preparing"
                            ? "cooking"
                            : r.status === "served"
                            ? "served"
                            : r.status === "completed"
                            ? "completed"
                            : "pending";
                        return (
                          <AdminBadge variant={variant} size="sm">
                            {r.status}
                          </AdminBadge>
                        );
                      },
                    },
                    {
                      key: "created_at",
                      header: "Time",
                      align: "right",
                      render: (r) =>
                        new Date(r.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                    },
                  ]}
                  data={orders.slice(0, 5)}
                  isLoading={isLoading}
                  emptyTitle="No orders yet"
                  emptySubtitle="Active table orders dispatched to kitchen will show up here."
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: DISHES & MENU CATALOG */}
          {/* ======================================================== */}
          {(currentView === "menu_items" || currentView === "stockout") && (
            <div className="space-y-4">
              <AdminTableFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search dishes by name or category..."
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                statusOptions={[
                  { label: "Available in Stock", value: "available" },
                  { label: "Out of Stock (86)", value: "unavailable" },
                ]}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                categoryOptions={categories.map((c) => ({ label: c, value: c }))}
                onReset={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                }}
                primaryActionLabel="Add Dish"
                onPrimaryAction={() => setIsAddDishOpen(true)}
              />

              <AdminDataTable<MenuItem>
                selectable
                columns={[
                  {
                    key: "name",
                    header: "Dish Name",
                    sortable: true,
                    render: (r) => (
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-3 h-3 rounded-xs border flex items-center justify-center shrink-0 ${
                            r.is_veg ? "border-green-600" : "border-red-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              r.is_veg ? "bg-green-600" : "bg-red-600"
                            }`}
                          />
                        </span>
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {r.name}
                          </span>
                          {r.description && (
                            <span className="text-[11px] text-slate-400 line-clamp-1">
                              {r.description}
                            </span>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "category",
                    header: "Category",
                    sortable: true,
                    render: (r) => (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {r.category}
                      </span>
                    ),
                  },
                  {
                    key: "price",
                    header: "Price",
                    align: "right",
                    sortable: true,
                    render: (r) => (
                      <span className="font-mono font-bold text-slate-900">
                        ₹{r.price}
                      </span>
                    ),
                  },
                  {
                    key: "is_available",
                    header: "Stock Status",
                    render: (r) => (
                      <button
                        type="button"
                        onClick={() => handleToggleStock(r.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                          r.is_available
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                        }`}
                      >
                        <i
                          className={`fa-solid ${
                            r.is_available ? "fa-circle-check" : "fa-ban"
                          } text-[10px]`}
                        />
                        <span>{r.is_available ? "In Stock" : "86'd (Out)"}</span>
                      </button>
                    ),
                  },
                ]}
                data={filteredMenuItems}
                isLoading={isLoading}
                rowActions={(r) => [
                  {
                    label: r.is_available ? "Mark Out of Stock" : "Mark In Stock",
                    icon: r.is_available ? "fa-ban" : "fa-check",
                    onClick: () => handleToggleStock(r.id),
                  },
                  {
                    label: "Delete",
                    icon: "fa-trash",
                    variant: "danger",
                    onClick: () => {
                      setMenuItems((prev) => prev.filter((d) => d.id !== r.id));
                    },
                  },
                ]}
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: LIVE ORDERS */}
          {/* ======================================================== */}
          {(currentView === "orders" || currentView === "approvals") && (
            <div className="space-y-4">
              <AdminTableFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search orders by Table, Customer or ID..."
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                statusOptions={[
                  { label: "Placed", value: "placed" },
                  { label: "Cooking / Preparing", value: "preparing" },
                  { label: "Served", value: "served" },
                  { label: "Completed", value: "completed" },
                  { label: "Cancelled", value: "cancelled" },
                ]}
                onReset={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              />

              <AdminDataTable<OrderRecord>
                selectable
                columns={[
                  {
                    key: "id",
                    header: "Order ID",
                    width: "120px",
                    render: (r) => (
                      <span className="font-mono text-slate-500">
                        #{r.id.slice(0, 8)}
                      </span>
                    ),
                  },
                  {
                    key: "table_number",
                    header: "Table",
                    sortable: true,
                    render: (r) => (
                      <span className="font-bold text-slate-900">
                        {r.table_number}
                      </span>
                    ),
                  },
                  {
                    key: "customer_name",
                    header: "Customer",
                    render: (r) => r.customer_name || "Dine-in Guest",
                  },
                  {
                    key: "item_count",
                    header: "Items",
                    align: "center",
                    render: (r) => r.item_count,
                  },
                  {
                    key: "total_amount",
                    header: "Total",
                    align: "right",
                    sortable: true,
                    render: (r) => (
                      <span className="font-mono font-bold text-slate-900">
                        ₹{r.total_amount}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (r) => {
                      const variant: BadgeVariant =
                        r.status === "preparing"
                          ? "cooking"
                          : r.status === "served"
                          ? "served"
                          : r.status === "completed"
                          ? "completed"
                          : r.status === "cancelled"
                          ? "cancelled"
                          : "pending";
                      return (
                        <AdminBadge variant={variant} size="sm">
                          {r.status}
                        </AdminBadge>
                      );
                    },
                  },
                  {
                    key: "created_at",
                    header: "Placed At",
                    align: "right",
                    render: (r) =>
                      new Date(r.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                  },
                ]}
                data={filteredOrders}
                isLoading={isLoading}
                rowActions={[
                  {
                    label: "Mark Served",
                    icon: "fa-utensils",
                    onClick: (r) => {
                      setOrders((prev) =>
                        prev.map((o) => (o.id === r.id ? { ...o, status: "served" } : o))
                      );
                    },
                  },
                  {
                    label: "Cancel Order",
                    icon: "fa-ban",
                    variant: "danger",
                    onClick: (r) => {
                      setOrders((prev) =>
                        prev.map((o) => (o.id === r.id ? { ...o, status: "cancelled" } : o))
                      );
                    },
                  },
                ]}
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: LIVE FLOOR & TABLES */}
          {/* ======================================================== */}
          {(currentView === "floor" || currentView === "qr_studio") && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Floor Plan & Table Management
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any table to view or print customer QR table code
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tables.map((t) => (
                  <div
                    key={t.id}
                    className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                      t.status === "occupied"
                        ? "border-purple-300 ring-2 ring-purple-100"
                        : "border-slate-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-base font-bold text-slate-900">
                          Table {t.table_number}
                        </span>
                        <AdminBadge
                          variant={t.status === "occupied" ? "cooking" : "active"}
                          size="sm"
                        >
                          {t.status === "occupied" ? "Occupied" : "Free"}
                        </AdminBadge>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1 mb-4">
                        <div className="flex justify-between">
                          <span>QR Token:</span>
                          <span className="font-mono text-slate-700">
                            {t.qr_token.slice(0, 10)}...
                          </span>
                        </div>
                        {t.active_bill_amount ? (
                          <div className="flex justify-between font-semibold text-slate-800">
                            <span>Running Bill:</span>
                            <span>₹{t.active_bill_amount}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <AdminButton
                        variant="outline"
                        size="sm"
                        leftIcon="fa-qrcode"
                        onClick={() => setSelectedQRTable(t)}
                        className="flex-1"
                      >
                        Print QR
                      </AdminButton>

                      <AdminButton
                        variant={t.status === "occupied" ? "ghost" : "primary"}
                        size="sm"
                        onClick={() => {
                          setTables((prev) =>
                            prev.map((tbl) =>
                              tbl.id === t.id
                                ? {
                                    ...tbl,
                                    status: tbl.status === "occupied" ? "available" : "occupied",
                                  }
                                : tbl
                            )
                          );
                        }}
                      >
                        {t.status === "occupied" ? "Vacate" : "Occupy"}
                      </AdminButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: STAFF ROSTER */}
          {/* ======================================================== */}
          {currentView === "staff" && (
            <div className="space-y-4">
              <AdminTableFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search staff by name or role..."
                primaryActionLabel="Add Staff"
                onPrimaryAction={() => setIsAddStaffOpen(true)}
              />

              <AdminDataTable<StaffRecord>
                columns={[
                  {
                    key: "name",
                    header: "Staff Member",
                    render: (r) => (
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">
                          {r.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900">
                          {r.name}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "role",
                    header: "Role",
                    render: (r) => (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 font-mono text-[10px]">
                        {r.role}
                      </span>
                    ),
                  },
                  {
                    key: "pin",
                    header: "Fast Login PIN",
                    render: (r) => (
                      <span className="font-mono text-slate-500">
                        {r.pin ? "••••" : "Not Set"}
                      </span>
                    ),
                  },
                  {
                    key: "is_active",
                    header: "Status",
                    render: () => (
                      <AdminBadge variant="active" size="sm">
                        Active
                      </AdminBadge>
                    ),
                  },
                ]}
                data={staffList}
                isLoading={isLoading}
                rowActions={[
                  {
                    label: "Remove Staff",
                    icon: "fa-trash",
                    variant: "danger",
                    onClick: (r) => {
                      setStaffList((prev) => prev.filter((s) => s.id !== r.id));
                    },
                  },
                ]}
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: ROLE-BASED ACCESS CONTROL (RBAC) SWITCHBOARD */}
          {/* ======================================================== */}
          {currentView === "roles" && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center text-xs shadow-xs">
                      <i className="fa-solid fa-shield-halved" />
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      Restaurant Role &amp; Entitlement Switchboard
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Restaurant owner controls which operational modules each staff role is entitled to access.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <AdminButton
                    variant="outline"
                    size="sm"
                    leftIcon="fa-rotate-left"
                    onClick={handleResetRoleDefaults}
                  >
                    Reset Defaults
                  </AdminButton>
                  <AdminButton
                    variant="primary"
                    size="sm"
                    leftIcon={isSavingRoles ? "fa-spinner fa-spin" : "fa-check"}
                    onClick={handleSaveRolePermissions}
                    disabled={isSavingRoles}
                  >
                    {isSavingRoles ? "Saving..." : "Save Access Matrix"}
                  </AdminButton>
                </div>
              </div>

              {rolesSaveMessage && (
                <div className="p-3.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 animate-in fade-in flex items-center gap-2">
                  <i className="fa-solid fa-circle-check text-emerald-600" />
                  <span>{rolesSaveMessage}</span>
                </div>
              )}

              {/* Permission Matrix Table */}
              <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        <th className="p-4 min-w-[220px]">System Module</th>
                        <th className="p-4 text-center">Owner (Full)</th>
                        <th className="p-4 text-center capitalize">Manager</th>
                        <th className="p-4 text-center capitalize">Captain</th>
                        <th className="p-4 text-center capitalize">Waiter</th>
                        <th className="p-4 text-center capitalize">Kitchen Chef</th>
                        <th className="p-4 text-center capitalize">Cashier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {MODULE_DEFS.map((mod) => (
                        <tr key={mod.key} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 text-xs">
                                <i className={`fa-solid ${mod.icon}`} />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">{mod.label}</span>
                                <span className="text-[11px] text-slate-500 block leading-tight">{mod.description}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <i className="fa-solid fa-lock text-[9px]" />
                              <span>Always Full</span>
                            </span>
                          </td>
                          {ROLES_LIST.map((roleKey) => {
                            const isAllowed = rolePermissions[roleKey]?.[mod.key] ?? false;
                            return (
                              <td key={roleKey} className="p-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isAllowed}
                                  onChange={(e) => handleToggleRoleModule(roleKey, mod.key, e.target.checked)}
                                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: INVOICES & FINANCE */}
          {/* ======================================================== */}
          {(currentView === "invoices" ||
            currentView === "cash_register" ||
            currentView === "taxes") && (
            <div className="space-y-4">
              <AdminTableFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search invoices by Bill # or Table..."
              />

              <AdminDataTable<InvoiceRecord>
                columns={[
                  {
                    key: "bill_number",
                    header: "Bill #",
                    render: (r) => (
                      <span className="font-mono font-bold text-slate-900">
                        {r.bill_number}
                      </span>
                    ),
                  },
                  {
                    key: "table_number",
                    header: "Table",
                    align: "center",
                    render: (r) => r.table_number,
                  },
                  {
                    key: "subtotal",
                    header: "Subtotal",
                    align: "right",
                    render: (r) => `₹${r.subtotal}`,
                  },
                  {
                    key: "tax_amount",
                    header: "GST (5%)",
                    align: "right",
                    render: (r) => `₹${r.tax_amount}`,
                  },
                  {
                    key: "total",
                    header: "Total Paid",
                    align: "right",
                    render: (r) => (
                      <span className="font-mono font-bold text-slate-900">
                        ₹{r.total}
                      </span>
                    ),
                  },
                  {
                    key: "payment_mode",
                    header: "Mode",
                    render: (r) => (
                      <span className="uppercase text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {r.payment_mode}
                      </span>
                    ),
                  },
                  {
                    key: "payment_status",
                    header: "Status",
                    render: () => (
                      <AdminBadge variant="paid" size="sm">
                        Settled
                      </AdminBadge>
                    ),
                  },
                ]}
                data={invoices}
                isLoading={isLoading}
                emptyTitle="No invoices generated yet"
                emptySubtitle="Completed orders will show bills and GST tax records here."
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: STORE & SYSTEM SETTINGS */}
          {/* ======================================================== */}
          {(currentView === "settings" || currentView === "hardware") && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Store & Operations Settings
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure table digital ordering, kitchen printing, and billing defaults
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      Customer QR Digital Ordering
                    </span>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Allows guests to scan table QR code to browse live menu and send orders.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      Kitchen KDS Auto-Routing
                    </span>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Automatically routes placed orders directly to kitchen station display.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      Thermal Printer Direct Dispatch
                    </span>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Automatically print 80mm KOT slips upon captain order approval.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      Persistent Sound Chime on New Order
                    </span>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Plays audio chime in Kitchen & Floor workspace on new orders and call bell.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAL: ADD NEW DISH */}
      {/* ======================================================== */}
      <AdminModal
        isOpen={isAddDishOpen}
        onClose={() => setIsAddDishOpen(false)}
        title="Add New Dish"
        subtitle="Create a new catalog item for your restaurant menu."
        icon="fa-bowl-food"
        confirmText="Save Dish"
        onConfirm={handleCreateDish}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Dish Name *
            </label>
            <input
              type="text"
              required
              value={newDishName}
              onChange={(e) => setNewDishName(e.target.value)}
              placeholder="e.g. Paneer Butter Masala"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Category *
              </label>
              <select
                value={newDishCategory}
                onChange={(e) => setNewDishCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 bg-white"
              >
                {categories.length > 0 ? (
                  categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Starters">Starters</option>
                    <option value="Main Course">Main Course</option>
                    <option value="Breads">Breads</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Desserts">Desserts</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Price (₹) *
              </label>
              <input
                type="number"
                required
                value={newDishPrice}
                onChange={(e) => setNewDishPrice(e.target.value)}
                placeholder="280"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Dietary Type
            </label>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="diet"
                  checked={newDishIsVeg}
                  onChange={() => setNewDishIsVeg(true)}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <span className="font-semibold text-emerald-700">Vegetarian</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="diet"
                  checked={!newDishIsVeg}
                  onChange={() => setNewDishIsVeg(false)}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <span className="font-semibold text-rose-700">Non-Vegetarian</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Short Description
            </label>
            <textarea
              rows={2}
              value={newDishDesc}
              onChange={(e) => setNewDishDesc(e.target.value)}
              placeholder="Fresh cottage cheese simmered in rich tomato butter gravy"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </AdminModal>

      {/* ======================================================== */}
      {/* MODAL: ADD NEW STAFF */}
      {/* ======================================================== */}
      <AdminModal
        isOpen={isAddStaffOpen}
        onClose={() => setIsAddStaffOpen(false)}
        title="Add Staff Member"
        subtitle="Create staff credentials for floor waiters or kitchen chefs."
        icon="fa-user-tag"
        confirmText="Save Staff"
        onConfirm={handleCreateStaff}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Staff Full Name *
            </label>
            <input
              type="text"
              required
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Role *
              </label>
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 bg-white"
              >
                <option value="waiter">Waiter (Floor Service)</option>
                <option value="kitchen">Kitchen Master (Chef)</option>
                <option value="captain">Captain (Floor Supervisor)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                4-Digit PIN *
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={newStaffPin}
                onChange={(e) => setNewStaffPin(e.target.value)}
                placeholder="1234"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono tracking-widest text-center"
              />
            </div>
          </div>
        </div>
      </AdminModal>

      {/* ======================================================== */}
      {/* REAL LUXURY TABLE QR CODE MODAL */}
      {/* ======================================================== */}
      <ShareMenuModal
        isOpen={!!selectedQRTable}
        onClose={() => setSelectedQRTable(null)}
        restaurantName={restaurantName || "Order Desk"}
        tables={tables.map((t) => ({
          id: t.id,
          table_number: t.table_number,
          qr_token: t.qr_token || "",
        }))}
        defaultTableId={selectedQRTable?.id}
      />
    </div>
  );
}
