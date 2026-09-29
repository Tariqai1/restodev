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

import StockoutView from "@/components/admin/views/StockoutView";
import KitchenKDSView from "@/components/admin/views/KitchenKDSView";
import ActivityLogsView from "@/components/admin/views/ActivityLogsView";
import CashRegisterView from "@/components/admin/views/CashRegisterView";
import TaxesView from "@/components/admin/views/TaxesView";
import HardwarePrintersView from "@/components/admin/views/HardwarePrintersView";
import AiStudioView from "@/components/admin/views/AiStudioView";
import TableQRStudioView from "@/components/admin/views/TableQRStudioView";
import ApprovalsView from "@/components/admin/views/ApprovalsView";
import StoreSettingsView from "@/components/admin/views/StoreSettingsView";

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
  category_id?: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  description?: string;
  has_half_portion?: boolean;
  half_price?: number;
  photo_url?: string | null;
  photo_urls?: string[];
  special_tag?: string;
}

interface CategoryRecord {
  id: string;
  name: string;
  sort_order: number;
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
  role: "waiter" | "kitchen" | "captain" | "manager" | "owner";
  pin: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
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
  const [restaurantId, setRestaurantId] = useState("");
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

  // Modals & Dish Management States
  const [isAddDishOpen, setIsAddDishOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
  const [dishName, setDishName] = useState("");
  const [dishCategory, setDishCategory] = useState("Main Course");
  const [dishPrice, setDishPrice] = useState("");
  const [dishIsVeg, setDishIsVeg] = useState(true);
  const [dishDesc, setDishDesc] = useState("");
  const [dishHasHalf, setDishHasHalf] = useState(false);
  const [dishHalfPrice, setDishHalfPrice] = useState("");
  const [halfPricingMode, setHalfPricingMode] = useState<"percentage" | "fixed">("percentage");
  const [halfPercentage, setHalfPercentage] = useState<number>(60);
  const [dishImages, setDishImages] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [isSavingDish, setIsSavingDish] = useState(false);
  const [categoriesList, setCategoriesList] = useState<CategoryRecord[]>([]);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryOrder, setNewCategoryOrder] = useState("0");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [inlineCategoryMode, setInlineCategoryMode] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"waiter" | "kitchen" | "captain" | "manager">("waiter");
  const [newStaffPin, setNewStaffPin] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [isEditStaffOpen, setIsEditStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffRecord | null>(null);
  const [editStaffName, setEditStaffName] = useState("");
  const [editStaffRole, setEditStaffRole] = useState<"waiter" | "kitchen" | "captain" | "manager">("waiter");
  const [editStaffPin, setEditStaffPin] = useState("");
  const [editStaffPhone, setEditStaffPhone] = useState("");
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // AI Copilot & Hub States
  const [isScanningOCR, setIsScanningOCR] = useState(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState("");
  const [isEstimatingPrep, setIsEstimatingPrep] = useState(false);
  const [prepEstimateMsg, setPrepEstimateMsg] = useState("");

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
          setRestaurantId(data.restaurant.id || "");
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
        const catsList: CategoryRecord[] = Array.isArray(menuData.categories)
          ? menuData.categories.map((c: any) => ({
              id: c.id,
              name: c.name,
              sort_order: c.sort_order ?? 0,
            }))
          : [];
        setCategoriesList(catsList);
        if (Array.isArray(menuData.categories)) {
          setCategories(menuData.categories.map((c: any) => c.name));
        }
        if (Array.isArray(menuData.items)) {
          setMenuItems(
            menuData.items.map((m: any) => ({
              id: m.id,
              name: m.name,
              category:
                m.menu_categories?.name ||
                m.category ||
                catsList.find((c) => c.id === m.category_id)?.name ||
                "General",
              category_id: m.category_id,
              price: Number(m.price) || 0,
              is_veg: Boolean(m.is_veg),
              is_available: m.is_available !== false,
              description: m.description,
              photo_url: m.photo_url || null,
              has_half_portion: Boolean(m.has_half_portion),
              half_price: m.half_price
                ? Number(m.half_price)
                : Math.round((Number(m.price) || 0) * 0.6),
              special_tag: m.special_tag,
            }))
          );
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
              pin: s.permissions?.assignedPin || s.pin || "••••",
              phone: s.phone || "",
              is_active: s.is_active !== false,
              created_at: s.created_at,
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

      // Fetch Invoices / Bills
      try {
        const billsRes = await fetch("/api/bills");
        if (billsRes.ok) {
          const billsData = await billsRes.json();
          if (Array.isArray(billsData.bills)) {
            setInvoices(
              billsData.bills.map((b: any) => ({
                id: b.id,
                bill_number: b.bill_number,
                table_number: b.table_number,
                order_id: b.order_id,
                subtotal: b.subtotal,
                tax_amount: b.tax_amount,
                total: b.total,
                payment_mode: b.payment_mode === "upi" || b.payment_mode === "card" ? b.payment_mode : "cash",
                payment_status: b.payment_status,
                paid_at: b.created_at,
              }))
            );
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

  // Open Add Dish Modal
  const openAddDishModal = () => {
    setEditingDish(null);
    setDishName("");
    setDishCategory(categories[0] || "Main Course");
    setDishPrice("");
    setDishIsVeg(true);
    setDishDesc("");
    setDishHasHalf(false);
    setHalfPricingMode("percentage");
    setHalfPercentage(60);
    setDishHalfPrice("");
    setDishImages([]);
    setUploadError("");
    setCustomImageUrl("");
    setIsAddDishOpen(true);
  };

  // Open Edit Dish Modal
  const openEditDishModal = (dish: MenuItem) => {
    setEditingDish(dish);
    setDishName(dish.name);
    setDishCategory(dish.category || "Main Course");
    setDishPrice(String(dish.price));
    setDishIsVeg(dish.is_veg);
    setDishDesc(dish.description || "");
    setDishHasHalf(Boolean(dish.has_half_portion));
    if (dish.half_price) {
      setDishHalfPrice(String(dish.half_price));
      const full = Number(dish.price) || 0;
      if (full > 0) {
        const pct = Math.round((dish.half_price / full) * 100);
        if ([50, 60, 65, 70].includes(pct)) {
          setHalfPricingMode("percentage");
          setHalfPercentage(pct);
        } else {
          setHalfPricingMode("fixed");
        }
      } else {
        setHalfPricingMode("fixed");
      }
    } else {
      const calc = Math.round((Number(dish.price) || 0) * 0.6);
      setDishHalfPrice(String(calc));
      setHalfPricingMode("percentage");
      setHalfPercentage(60);
    }
    const imgs: string[] = [];
    if (dish.photo_url) imgs.push(dish.photo_url);
    if (Array.isArray(dish.photo_urls)) {
      dish.photo_urls.forEach((u) => {
        if (u && !imgs.includes(u)) imgs.push(u);
      });
    }
    setDishImages(imgs);
    setUploadError("");
    setCustomImageUrl("");
    setIsAddDishOpen(true);
  };

  // Multi-Image Upload Handler
  const handleUploadImages = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploadingImages(true);
    setUploadError("");
    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.url) {
          newUrls.push(data.url);
        } else {
          setUploadError(data.message || "Failed to upload one or more images");
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Network error during upload");
      }
    }

    if (newUrls.length > 0) {
      setDishImages((prev) => [...prev, ...newUrls]);
    }
    setIsUploadingImages(false);
  };

  const handleAddImageUrl = () => {
    const url = customImageUrl.trim();
    if (!url) return;
    if (!dishImages.includes(url)) {
      setDishImages((prev) => [...prev, url]);
    }
    setCustomImageUrl("");
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setDishImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetPrimaryImage = (indexToPrimary: number) => {
    setDishImages((prev) => {
      const selected = prev[indexToPrimary];
      const rest = prev.filter((_, idx) => idx !== indexToPrimary);
      return [selected, ...rest];
    });
  };

  // Save Dish Action (Supports both Add New and Edit Existing)
  const handleSaveDish = async () => {
    if (!dishName.trim() || !dishPrice) return;
    setIsSavingDish(true);
    try {
      const matchedCat = categoriesList.find((c) => c.name === dishCategory);
      const catId = matchedCat?.id || editingDish?.category_id;
      const primaryPhoto = dishImages[0] || "";
      const calculatedHalfPrice = dishHasHalf
        ? halfPricingMode === "percentage"
          ? Math.round((Number(dishPrice) || 0) * (halfPercentage / 100))
          : Number(dishHalfPrice) || Math.round((Number(dishPrice) || 0) * 0.6)
        : undefined;

      if (editingDish) {
        const res = await fetch("/api/menu", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: editingDish.id,
            name: dishName.trim(),
            categoryId: catId,
            price: Number(dishPrice),
            isVeg: dishIsVeg,
            description: dishDesc.trim() || null,
            hasHalfPortion: dishHasHalf,
            halfPrice: calculatedHalfPrice,
            photoUrl: primaryPhoto || null,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const updatedItem = data.item;
          setMenuItems((prev) =>
            prev.map((d) =>
              d.id === editingDish.id
                ? {
                    ...d,
                    name: updatedItem?.name || dishName.trim(),
                    category: dishCategory,
                    category_id: catId,
                    price: Number(dishPrice),
                    is_veg: dishIsVeg,
                    description: dishDesc.trim(),
                    has_half_portion: dishHasHalf,
                    half_price: calculatedHalfPrice,
                    photo_url: primaryPhoto || null,
                  }
                : d
            )
          );
        } else {
          setMenuItems((prev) =>
            prev.map((d) =>
              d.id === editingDish.id
                ? {
                    ...d,
                    name: dishName.trim(),
                    category: dishCategory,
                    price: Number(dishPrice),
                    is_veg: dishIsVeg,
                    description: dishDesc.trim(),
                    has_half_portion: dishHasHalf,
                    half_price: calculatedHalfPrice,
                    photo_url: primaryPhoto || null,
                  }
                : d
            )
          );
        }
      } else {
        const res = await fetch("/api/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: dishName.trim(),
            categoryId: catId,
            price: Number(dishPrice),
            isVeg: dishIsVeg,
            description: dishDesc.trim() || null,
            hasHalfPortion: dishHasHalf,
            halfPrice: calculatedHalfPrice,
            photoUrl: primaryPhoto || null,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const createdItem = data.item;
          const newDish: MenuItem = {
            id: createdItem?.id || `dish-${Date.now()}`,
            name: createdItem?.name || dishName.trim(),
            category: dishCategory,
            category_id: catId,
            price: Number(dishPrice),
            is_veg: dishIsVeg,
            is_available: true,
            description: dishDesc.trim(),
            has_half_portion: dishHasHalf,
            half_price: calculatedHalfPrice,
            photo_url: primaryPhoto || null,
          };
          setMenuItems((prev) => [newDish, ...prev]);
        } else {
          const newDish: MenuItem = {
            id: `dish-${Date.now()}`,
            name: dishName.trim(),
            category: dishCategory,
            price: Number(dishPrice),
            is_veg: dishIsVeg,
            is_available: true,
            description: dishDesc.trim(),
            has_half_portion: dishHasHalf,
            half_price: calculatedHalfPrice,
            photo_url: primaryPhoto || null,
          };
          setMenuItems((prev) => [newDish, ...prev]);
        }
      }

      setIsAddDishOpen(false);
      setEditingDish(null);
    } catch (err) {
      console.error("Failed to save dish:", err);
    } finally {
      setIsSavingDish(false);
    }
  };

  // Delete Dish Action
  const handleDeleteDish = async (dishId: string) => {
    setMenuItems((prev) => prev.filter((d) => d.id !== dishId));
    try {
      await fetch(`/api/menu?id=${dishId}`, { method: "DELETE" });
    } catch (err) {
      console.warn("Failed to delete dish on server:", err);
    }
  };

  // Toggle Dish Availability (86-List)
  const handleToggleStock = async (dishId: string) => {
    const dish = menuItems.find((d) => d.id === dishId);
    if (!dish) return;
    const newStock = !dish.is_available;
    setMenuItems((prev) =>
      prev.map((d) => (d.id === dishId ? { ...d, is_available: newStock } : d))
    );
    try {
      await fetch("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: dishId, isAvailable: newStock }),
      });
    } catch (err) {
      console.warn("Failed to sync stock on server:", err);
    }
  };

  // Category Actions
  const handleSaveCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        const res = await fetch("/api/menu/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: editingCategory.id,
            name,
            sortOrder: Number(newCategoryOrder) || 0,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data.category;
          setCategoriesList((prev) =>
            prev.map((c) =>
              c.id === editingCategory.id
                ? {
                    ...c,
                    name: updated?.name || name,
                    sort_order: updated?.sort_order ?? Number(newCategoryOrder),
                  }
                : c
            )
          );
          setCategories((prev) =>
            prev.map((c) => (c === editingCategory.name ? name : c))
          );
        }
      } else {
        const res = await fetch("/api/menu/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            sortOrder: Number(newCategoryOrder) || categoriesList.length + 1,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const created = data.category;
          const newRec: CategoryRecord = {
            id: created?.id || `cat-${Date.now()}`,
            name: created?.name || name,
            sort_order: created?.sort_order ?? categoriesList.length + 1,
          };
          setCategoriesList((prev) => [...prev, newRec]);
          setCategories((prev) => [...prev, name]);
        }
      }
      setIsAddCategoryOpen(false);
      setEditingCategory(null);
      setNewCategoryName("");
      setNewCategoryOrder("0");
    } catch (err) {
      console.error("Failed to save category:", err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete category "${catName}"? Dishes in this category will become uncategorized.`
      )
    )
      return;
    setCategoriesList((prev) => prev.filter((c) => c.id !== catId));
    setCategories((prev) => prev.filter((c) => c !== catName));
    try {
      await fetch(`/api/menu/categories?id=${catId}`, { method: "DELETE" });
    } catch (err) {
      console.warn("Failed to delete category on server:", err);
    }
  };

  const handleQuickCreateInlineCategory = async () => {
    const name = inlineCategoryName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/menu/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sortOrder: categoriesList.length + 1,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = data.category;
        const newRec: CategoryRecord = {
          id: created?.id || `cat-${Date.now()}`,
          name: created?.name || name,
          sort_order: created?.sort_order ?? categoriesList.length + 1,
        };
        setCategoriesList((prev) => [...prev, newRec]);
        setCategories((prev) => [...prev, name]);
      } else {
        setCategories((prev) => [...prev, name]);
      }
      setDishCategory(name);
      setInlineCategoryName("");
      setInlineCategoryMode(false);
    } catch (err) {
      console.error("Failed to quick create inline category:", err);
    }
  };

  // Add Staff Action
  const handleCreateStaff = async () => {
    if (!newStaffName.trim() || !newStaffPin) return;
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStaffName.trim(),
          role: newStaffRole,
          pin: newStaffPin.trim(),
          phone: newStaffPhone.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = data.staff;
        const newMember: StaffRecord = {
          id: created?.id || `staff-${Date.now()}`,
          name: created?.name || newStaffName.trim(),
          role: created?.role || newStaffRole,
          pin: newStaffPin.trim(),
          phone: newStaffPhone.trim(),
          is_active: true,
        };
        setStaffList((prev) => [...prev, newMember]);
      } else {
        const newMember: StaffRecord = {
          id: `staff-${Date.now()}`,
          name: newStaffName.trim(),
          role: newStaffRole,
          pin: newStaffPin.trim(),
          phone: newStaffPhone.trim(),
          is_active: true,
        };
        setStaffList((prev) => [...prev, newMember]);
      }
      setIsAddStaffOpen(false);
      setNewStaffName("");
      setNewStaffPin("");
      setNewStaffPhone("");
    } catch (err) {
      console.error("Failed to create staff member:", err);
    }
  };

  // Toggle Staff Status (1-Click Active / Deactivate)
  const handleToggleStaffStatus = async (staffId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, is_active: newStatus } : s))
    );
    try {
      await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, isActive: newStatus }),
      });
    } catch (err) {
      console.warn("Failed to update staff status:", err);
    }
  };

  // Open Edit Staff Modal
  const handleOpenEditStaff = (staff: StaffRecord) => {
    setEditingStaff(staff);
    setEditStaffName(staff.name);
    setEditStaffRole(staff.role as any);
    setEditStaffPin(staff.pin && staff.pin !== "••••" ? staff.pin : "");
    setEditStaffPhone(staff.phone || "");
    setIsEditStaffOpen(true);
  };

  // Save Edit Staff Details & PIN
  const handleSaveEditStaff = async () => {
    if (!editingStaff) return;
    setIsSavingStaff(true);
    try {
      const payload: Record<string, any> = {
        staffId: editingStaff.id,
        name: editStaffName.trim(),
        role: editStaffRole,
        phone: editStaffPhone.trim(),
      };
      if (editStaffPin.trim().length === 4) {
        payload.newPin = editStaffPin.trim();
      }
      const res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStaffList((prev) =>
          prev.map((s) =>
            s.id === editingStaff.id
              ? {
                  ...s,
                  name: editStaffName.trim(),
                  role: editStaffRole,
                  phone: editStaffPhone.trim(),
                  pin: editStaffPin.trim() || s.pin,
                }
              : s
          )
        );
      }
      setIsEditStaffOpen(false);
      setEditingStaff(null);
    } catch (err) {
      console.error("Failed to update staff:", err);
    } finally {
      setIsSavingStaff(false);
    }
  };

  // Restock All Sold Out Items (86-List)
  const handleRestockAll = async () => {
    const outItems = menuItems.filter((m) => !m.is_available);
    setMenuItems((prev) => prev.map((m) => ({ ...m, is_available: true })));
    for (const item of outItems) {
      try {
        await fetch("/api/menu", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: item.id, isAvailable: true }),
        });
      } catch (err) {
        console.warn("Restock item error:", err);
      }
    }
  };

  // KDS & Order Status Handlers
  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: "preparing" | "served" | "completed"
  ) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  };

  const handleApproveOrder = async (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "preparing" } : o))
    );
  };

  const handleRejectOrder = async (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o))
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
    ai_studio: { title: "AI Copilot & OCR Hub", breadcrumb: ["Admin", "Catalog", "AI Studio"] },
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
                onPrimaryAction={openAddDishModal}
              />

              <AdminDataTable<MenuItem>
                selectable
                columns={[
                  {
                    key: "name",
                    header: "Dish Details",
                    sortable: true,
                    render: (r) => (
                      <div className="flex items-center gap-3">
                        {r.photo_url ? (
                          <img
                            src={r.photo_url}
                            alt={r.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <i className="fa-solid fa-utensils text-xs" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2.5 h-2.5 rounded-xs border flex items-center justify-center shrink-0 ${
                                r.is_veg ? "border-green-600" : "border-red-600"
                              }`}
                            >
                              <span
                                className={`w-1 h-1 rounded-full ${
                                  r.is_veg ? "bg-green-600" : "bg-red-600"
                                }`}
                              />
                            </span>
                            <span className="font-semibold text-slate-900 truncate">
                              {r.name}
                            </span>
                          </div>
                          {r.description && (
                            <span className="text-[11px] text-slate-400 line-clamp-1 block">
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
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900 block">
                          ₹{r.price}
                        </span>
                        {r.has_half_portion && (
                          <span className="inline-block text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 mt-0.5">
                            Half ₹{Math.round(r.price * 0.6)}
                          </span>
                        )}
                      </div>
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
                    label: "Edit Dish",
                    icon: "fa-pen-to-square",
                    onClick: () => openEditDishModal(r),
                  },
                  {
                    label: r.is_available ? "Mark Out of Stock" : "Mark In Stock",
                    icon: r.is_available ? "fa-ban" : "fa-check",
                    onClick: () => handleToggleStock(r.id),
                  },
                  {
                    label: "Delete",
                    icon: "fa-trash",
                    variant: "danger",
                    onClick: () => handleDeleteDish(r.id),
                  },
                ]}
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: MENU CATEGORIES */}
          {/* ======================================================== */}
          {currentView === "menu_categories" && (
            <div className="space-y-4">
              <AdminTableFilters
                searchQuery={categorySearchQuery}
                onSearchChange={setCategorySearchQuery}
                searchPlaceholder="Search categories by name..."
                onReset={() => setCategorySearchQuery("")}
                primaryActionLabel="Add Category"
                onPrimaryAction={() => {
                  setEditingCategory(null);
                  setNewCategoryName("");
                  setNewCategoryOrder(String(categoriesList.length + 1));
                  setIsAddCategoryOpen(true);
                }}
              />

              <AdminDataTable<CategoryRecord>
                selectable
                columns={[
                  {
                    key: "name",
                    header: "Category Name",
                    sortable: true,
                    render: (r) => (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-layer-group text-sm" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block text-sm">
                            {r.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ID: #{r.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "assigned_dishes",
                    header: "Assigned Dishes",
                    align: "center",
                    render: (r) => {
                      const count = menuItems.filter(
                        (m) => m.category === r.name || m.category_id === r.id
                      ).length;
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          <i className="fa-solid fa-bowl-food text-[10px]" />
                          <span>
                            {count} {count === 1 ? "Dish" : "Dishes"}
                          </span>
                        </span>
                      );
                    },
                  },
                  {
                    key: "sort_order",
                    header: "Display Order",
                    align: "center",
                    sortable: true,
                    render: (r) => (
                      <span className="font-mono font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-xs">
                        #{r.sort_order}
                      </span>
                    ),
                  },
                ]}
                data={categoriesList.filter((c) =>
                  c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
                )}
                isLoading={isLoading}
                rowActions={(r) => [
                  {
                    label: "Edit Category",
                    icon: "fa-pen-to-square",
                    onClick: () => {
                      setEditingCategory(r);
                      setNewCategoryName(r.name);
                      setNewCategoryOrder(String(r.sort_order));
                      setIsAddCategoryOpen(true);
                    },
                  },
                  {
                    label: "Delete",
                    icon: "fa-trash",
                    variant: "danger",
                    onClick: () => handleDeleteCategory(r.id, r.name),
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
          {/* VIEW: 86 / STOCK OUT LIST */}
          {/* ======================================================== */}
          {currentView === "stockout" && (
            <StockoutView
              dishes={menuItems}
              onToggleStock={handleToggleStock}
              onRestockAll={handleRestockAll}
              isLoading={isLoading}
            />
          )}

          {/* ======================================================== */}
          {/* VIEW: KITCHEN DISPLAY (KDS) */}
          {/* ======================================================== */}
          {currentView === "kitchen" && (
            <KitchenKDSView
              orders={orders as any}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onRefresh={fetchData}
            />
          )}

          {/* ======================================================== */}
          {/* VIEW: CAPTAIN APPROVALS */}
          {/* ======================================================== */}
          {currentView === "approvals" && (
            <ApprovalsView
              pendingOrders={orders.filter((o) => o.status === "placed") as any}
              onApproveOrder={handleApproveOrder}
              onRejectOrder={handleRejectOrder}
            />
          )}

          {/* ======================================================== */}
          {/* VIEW: LIVE FLOOR & TABLES */}
          {/* ======================================================== */}
          {currentView === "floor" && (
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
          {/* VIEW: TABLE QR STUDIO */}
          {/* ======================================================== */}
          {currentView === "qr_studio" && (
            <TableQRStudioView
              tables={tables as any}
              restaurantName={restaurantName}
            />
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
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {r.name}
                          </span>
                          {r.phone && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {r.phone}
                            </span>
                          )}
                        </div>
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
                      <span className="font-mono text-slate-500 font-bold tracking-wider">
                        {r.pin ? "••••" : "Not Set"}
                      </span>
                    ),
                  },
                  {
                    key: "is_active",
                    header: "Status",
                    render: (r) => (
                      <button
                        type="button"
                        onClick={() => handleToggleStaffStatus(r.id, r.is_active)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          r.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                        }`}
                        title="Click to toggle Active / Deactivated"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            r.is_active ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        <span>{r.is_active ? "Active" : "Deactivated"}</span>
                      </button>
                    ),
                  },
                ]}
                data={staffList}
                isLoading={isLoading}
                rowActions={[
                  {
                    label: "Edit & Change PIN",
                    icon: "fa-pen-to-square",
                    onClick: (r) => handleOpenEditStaff(r),
                  },
                  {
                    label: "Remove Staff",
                    icon: "fa-trash",
                    variant: "danger",
                    onClick: (r) => {
                      if (confirm(`Remove staff member ${r.name}?`)) {
                        setStaffList((prev) => prev.filter((s) => s.id !== r.id));
                      }
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
          {/* VIEW: AUDIT & ACTIVITY LOGS */}
          {/* ======================================================== */}
          {currentView === "activity" && <ActivityLogsView />}

          {/* ======================================================== */}
          {/* VIEW: INVOICES & RECEIPTS */}
          {/* ======================================================== */}
          {currentView === "invoices" && (
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
          {/* VIEW: DAY-END CASH REGISTER */}
          {/* ======================================================== */}
          {currentView === "cash_register" && <CashRegisterView />}

          {/* ======================================================== */}
          {/* VIEW: TAXES & FINANCIAL YEAR */}
          {/* ======================================================== */}
          {currentView === "taxes" && <TaxesView />}

          {/* ======================================================== */}
          {/* VIEW: HARDWARE & PRINTERS */}
          {/* ======================================================== */}
          {currentView === "hardware" && <HardwarePrintersView />}

          {/* ======================================================== */}
          {/* VIEW: STORE & SYSTEM SETTINGS */}
          {/* ======================================================== */}
          {currentView === "settings" && <StoreSettingsView initialName={restaurantName} />}

          {/* ======================================================== */}
          {/* VIEW: AI COPILOT & OCR HUB */}
          {/* ======================================================== */}
          {currentView === "ai_studio" && (
            <AiStudioView
              restaurantId={restaurantId}
              onGoToMenu={() => setCurrentView("menu_items")}
              onDataUpdated={fetchData}
            />
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT DISH WITH MULTI-IMAGE & HALF-PORTION */}
      {/* ======================================================== */}
      <AdminModal
        isOpen={isAddDishOpen}
        onClose={() => {
          setIsAddDishOpen(false);
          setEditingDish(null);
        }}
        title={editingDish ? "Edit Dish Details" : "Add New Dish"}
        subtitle={
          editingDish
            ? "Update dish pricing, half portion settings, photos and details."
            : "Create a new catalog item with photos, half/full pricing for your menu."
        }
        icon="fa-bowl-food"
        maxWidth="lg"
        confirmText={isSavingDish ? "Saving..." : editingDish ? "Update Dish" : "Save Dish"}
        isConfirmLoading={isSavingDish}
        onConfirm={handleSaveDish}
      >
        <div className="space-y-4 text-xs">
          {/* Dish Name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Dish Name *
            </label>
            <input
              type="text"
              required
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              placeholder="e.g. Paneer Butter Masala"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 text-sm"
            />
          </div>

          {/* Category & Price */}
          <div className="grid grid-cols-2 gap-3">
            {/* If inline category mode is active, show full-width row */}
            {inlineCategoryMode && (
              <div className="col-span-2 p-2.5 bg-purple-50/90 border border-purple-200 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[11px] font-bold text-purple-900">
                  <span>Create New Menu Category</span>
                  <button
                    type="button"
                    onClick={() => setInlineCategoryMode(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Starters, Main Course, Breads..."
                    value={inlineCategoryName}
                    onChange={(e) => setInlineCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleQuickCreateInlineCategory();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateInlineCategory}
                    disabled={!inlineCategoryName.trim()}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0 shadow-xs"
                  >
                    Save Category
                  </button>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Category *
                </label>
                {!inlineCategoryMode && (
                  <button
                    type="button"
                    onClick={() => setInlineCategoryMode(true)}
                    className="text-[10px] font-bold text-purple-600 hover:text-purple-800 cursor-pointer flex items-center gap-1"
                  >
                    <i className="fa-solid fa-plus" />
                    <span>New</span>
                  </button>
                )}
              </div>

              <select
                value={dishCategory}
                onChange={(e) => setDishCategory(e.target.value)}
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
                Full Price (₹) *
              </label>
              <input
                type="number"
                required
                value={dishPrice}
                onChange={(e) => setDishPrice(e.target.value)}
                placeholder="280"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono font-bold"
              />
            </div>
          </div>

          {/* Dietary Type */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Dietary Type
            </label>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dishDiet"
                  checked={dishIsVeg}
                  onChange={() => setDishIsVeg(true)}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs border border-green-600 flex items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-green-600" />
                  </span>
                  Vegetarian
                </span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dishDiet"
                  checked={!dishIsVeg}
                  onChange={() => setDishIsVeg(false)}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <span className="font-semibold text-rose-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs border border-red-600 flex items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-red-600" />
                  </span>
                  Non-Vegetarian
                </span>
              </label>
            </div>
          </div>

          {/* FULL / HALF PORTION OPTION */}
          <div className="border border-slate-200 bg-slate-50/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-scale-balanced" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs block">
                    Offer Half Portion (Full &amp; Half Sizing)
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Allow diners to order Half or Full portion on QR menu
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDishHasHalf(!dishHasHalf)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                  dishHasHalf ? "bg-purple-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    dishHasHalf ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {dishHasHalf && (
              <div className="pt-3 border-t border-slate-200 space-y-3 animate-in fade-in">
                {/* Mode Selector: Percentage vs Custom Fixed Price */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">Pricing Mode:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setHalfPricingMode("percentage")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        halfPricingMode === "percentage"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Percentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHalfPricingMode("fixed");
                        if (!dishHalfPrice) {
                          setDishHalfPrice(String(Math.round((Number(dishPrice) || 0) * 0.6)));
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        halfPricingMode === "fixed"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Custom Fixed Price (₹)
                    </button>
                  </div>
                </div>

                {/* Percentage Mode Controls */}
                {halfPricingMode === "percentage" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[50, 60, 65, 70].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setHalfPercentage(pct)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          halfPercentage === pct
                            ? "bg-purple-700 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-700 hover:border-purple-300"
                        }`}
                      >
                        {pct}% {pct === 60 ? "(Standard)" : ""}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-2">
                      <input
                        type="number"
                        min="20"
                        max="90"
                        value={halfPercentage}
                        onChange={(e) => setHalfPercentage(Number(e.target.value) || 60)}
                        className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center"
                      />
                      <span className="text-slate-500 font-bold">%</span>
                    </div>
                  </div>
                ) : (
                  /* Custom Fixed Price Input */
                  <div className="flex items-center gap-2 max-w-xs">
                    <span className="text-xs font-bold text-slate-700">Half Portion Price:</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 170"
                        value={dishHalfPrice}
                        onChange={(e) => setDishHalfPrice(e.target.value)}
                        className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                )}

                {/* Live Preview Pill */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Pricing Preview:</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-800 font-bold font-mono text-xs shadow-xs">
                      <span>
                        Half: ₹
                        {halfPricingMode === "percentage"
                          ? Math.round((Number(dishPrice) || 0) * (halfPercentage / 100))
                          : Number(dishHalfPrice) || 0}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>Full: ₹{dishPrice || 0}</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                    <i className="fa-solid fa-check text-[9px]" /> Full &amp; Half Active
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* MULTIPLE IMAGE UPLOAD GALLERY */}
          <div className="border border-slate-200 bg-slate-50/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-images" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs block">
                    Dish Images (Multiple Upload Supported)
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Upload multiple high-res photos. The first photo is the primary cover.
                  </span>
                </div>
              </div>
              {dishImages.length > 0 && (
                <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  {dishImages.length} {dishImages.length === 1 ? "Photo" : "Photos"}
                </span>
              )}
            </div>

            {/* Gallery Thumbnails */}
            {dishImages.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 pt-1">
                {dishImages.map((imgUrl, idx) => (
                  <div
                    key={`${imgUrl}-${idx}`}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white shadow-xs"
                  >
                    <img
                      src={imgUrl}
                      alt={`Dish ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Primary / Cover Badge */}
                    {idx === 0 ? (
                      <span className="absolute top-1 left-1 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1 z-10">
                        <i className="fa-solid fa-star text-[8px]" /> Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryImage(idx)}
                        className="absolute bottom-1 left-1 right-1 text-[9px] font-semibold bg-slate-900/80 hover:bg-slate-900 text-white py-0.5 rounded text-center cursor-pointer opacity-90 transition-opacity z-10"
                        title="Set as Cover Photo"
                      >
                        Set Cover
                      </button>
                    )}

                    {/* Delete Image Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] cursor-pointer shadow-xs transition-colors z-10"
                      title="Remove image"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Controls */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isUploadingImages}
                  onChange={(e) => {
                    if (e.target.files) handleUploadImages(e.target.files);
                  }}
                  className="hidden"
                  id="dish-images-upload"
                />
                <label
                  htmlFor="dish-images-upload"
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-purple-400 bg-purple-50/70 hover:bg-purple-100/70 text-purple-700 font-bold text-xs cursor-pointer transition-colors shadow-2xs ${
                    isUploadingImages ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  <i
                    className={`fa-solid ${
                      isUploadingImages
                        ? "fa-spinner fa-spin"
                        : "fa-cloud-arrow-up"
                    }`}
                  />
                  <span>
                    {isUploadingImages
                      ? "Uploading to Cloud..."
                      : dishImages.length > 0
                      ? "Upload More Photos"
                      : "Choose Photos (Multiple)"}
                  </span>
                </label>

                <span className="text-[11px] text-slate-400">
                  JPG, PNG, WebP up to 5MB each
                </span>
              </div>

              {/* Paste Direct URL */}
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Or paste direct image URL (https://...)"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddImageUrl();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-purple-500 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  disabled={!customImageUrl.trim()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Add URL
                </button>
              </div>

              {uploadError && (
                <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                  <i className="fa-solid fa-circle-exclamation" /> {uploadError}
                </p>
              )}
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Short Description
            </label>
            <textarea
              rows={2}
              value={dishDesc}
              onChange={(e) => setDishDesc(e.target.value)}
              placeholder="Fresh cottage cheese simmered in rich tomato butter gravy"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 text-xs"
            />
          </div>
        </div>
      </AdminModal>

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT MENU CATEGORY */}
      {/* ======================================================== */}
      <AdminModal
        isOpen={isAddCategoryOpen}
        onClose={() => {
          setIsAddCategoryOpen(false);
          setEditingCategory(null);
        }}
        title={editingCategory ? "Edit Category" : "Add Menu Category"}
        subtitle={
          editingCategory
            ? "Update the category name and display order."
            : "Create a new category for grouping your menu dishes (e.g. Starters, Main Course, Chinese, Beverages)."
        }
        icon="fa-layer-group"
        maxWidth="md"
        confirmText={
          isSavingCategory
            ? "Saving..."
            : editingCategory
            ? "Update Category"
            : "Create Category"
        }
        isConfirmLoading={isSavingCategory}
        onConfirm={handleSaveCategory}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Tandoori Special, Chinese, Mocktails"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Display Sort Order
            </label>
            <input
              type="number"
              value={newCategoryOrder}
              onChange={(e) => setNewCategoryOrder(e.target.value)}
              placeholder="1"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono text-sm"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Lower numbers appear first on customer QR table menu.
            </p>
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

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Mobile Phone (Optional)
            </label>
            <input
              type="tel"
              value={newStaffPhone}
              onChange={(e) => setNewStaffPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>
      </AdminModal>

      {/* ======================================================== */}
      {/* MODAL: EDIT STAFF MEMBER & CHANGE PIN */}
      {/* ======================================================== */}
      <AdminModal
        isOpen={isEditStaffOpen}
        onClose={() => {
          setIsEditStaffOpen(false);
          setEditingStaff(null);
        }}
        title="Edit Staff Member & PIN"
        subtitle={`Update details and 4-digit fast login PIN for ${editingStaff?.name || "Staff Member"}.`}
        icon="fa-user-pen"
        confirmText={isSavingStaff ? "Saving..." : "Update Staff"}
        isConfirmLoading={isSavingStaff}
        onConfirm={handleSaveEditStaff}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Staff Full Name *
            </label>
            <input
              type="text"
              required
              value={editStaffName}
              onChange={(e) => setEditStaffName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 text-sm font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Role *
              </label>
              <select
                value={editStaffRole}
                onChange={(e) => setEditStaffRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 bg-white"
              >
                <option value="waiter">Waiter (Floor Service)</option>
                <option value="kitchen">Kitchen Master (Chef)</option>
                <option value="captain">Captain (Floor Supervisor)</option>
                <option value="manager">Manager</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Change 4-Digit PIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={editStaffPin}
                onChange={(e) => setEditStaffPin(e.target.value)}
                placeholder="Leave blank to keep"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono tracking-widest text-center"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Type 4 digits to reset PIN
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Mobile Phone
            </label>
            <input
              type="tel"
              value={editStaffPhone}
              onChange={(e) => setEditStaffPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono"
            />
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
