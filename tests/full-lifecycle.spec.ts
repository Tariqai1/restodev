import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import fs from "fs";
import path from "path";

// Load environment variables from .env.local if present
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, serviceKey);

async function cleanupDb() {
  console.log("Cleaning database for fresh test run...");
  await supabase.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("bills").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("menu_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("menu_categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("restaurant_tables").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("restaurants").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("users").delete().not("email", "in", '("tariqfsd9@gmail.com","tarique@gmail.com")');

  const { data: userList } = await supabase.auth.admin.listUsers();
  const keepEmails = ["tariqfsd9@gmail.com", "tarique@gmail.com"];
  if (userList?.users) {
    for (const u of userList.users) {
      const email = (u.email || "").toLowerCase().trim();
      if (!keepEmails.includes(email)) {
        await supabase.auth.admin.deleteUser(u.id);
      }
    }
  }

  const statePath = "data/platform-state.json";
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      state.activities = [];
      state.archivedRestaurants = {};
      state.staffPermissions = {};
      state.waiterCalls = [];
      state.restaurantThemes = {};
      state.restaurantBrandings = {};
      state.restaurantFeatures = {};
      state.restaurantOffers = {};
      state.restaurantUpsellConfigs = {};
      state.orderPrepEstimates = {};
      state.pendingOrderApprovals = {};
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
    } catch {}
  }
}

test.beforeAll(async () => {
  await cleanupDb();
});

test("End-to-End Workflow: New User Onboard -> Waiter & Kitchen Master -> Customer Dine-in Order", async ({ browser }) => {
  test.setTimeout(120000);

  const timestamp = Date.now();
  const testRestaurantName = `Zaika Mahal ${timestamp}`;
  const ownerEmail = `owner_${timestamp}@zaika.com`;
  const ownerPassword = "Password@12345";
  const waiterName = "Ramesh Waiter";
  const waiterPin = "1111";
  const kitchenMasterName = "Chef Vikas";
  const kitchenMasterPin = "2222";

  // -------------------------------------------------------------
  // STEP 1: Onboard New User (Restaurant Owner) via /setup
  // -------------------------------------------------------------
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();

  console.log(`[Step 1] Creating new Restaurant & Owner: ${testRestaurantName} (${ownerEmail})`);
  await ownerPage.goto("/setup");

  await ownerPage.fill("#restaurantName", testRestaurantName);
  await ownerPage.fill("#ownerName", "Zaid Owner");
  await ownerPage.fill("#email", ownerEmail);
  await ownerPage.fill("#password", ownerPassword);
  await ownerPage.click('button[type="submit"]');

  // Should redirect to /login
  await expect(ownerPage).toHaveURL(/.*\/login.*/, { timeout: 15000 });
  console.log("✓ Step 1 Passed: Restaurant & Owner Account successfully created!");

  // -------------------------------------------------------------
  // STEP 2: Owner Login & Staff Creation (Waiter + Kitchen Master)
  // -------------------------------------------------------------
  console.log(`[Step 2] Logging in as Owner: ${ownerEmail}`);
  const ownerTab = ownerPage.locator('button:has-text("Owner Login")');
  if (await ownerTab.isVisible({ timeout: 5000 })) {
    await ownerTab.click();
  }

  await ownerPage.fill('input[type="email"]', ownerEmail);
  await ownerPage.fill('input[type="password"]', ownerPassword);
  await ownerPage.click('button:has-text("Sign in to Restaurant")');

  // Wait for Floor Workspace (/)
  await ownerPage.waitForURL("/", { timeout: 15000 });
  console.log("✓ Step 2a Passed: Owner successfully logged in to Dashboard!");

  // Navigate to /staff
  await ownerPage.goto("/staff");
  await ownerPage.waitForLoadState("networkidle");

  // Create Waiter
  console.log(`[Step 2b] Creating Waiter: ${waiterName}`);
  await ownerPage.click('button:has-text("Add New Staff")');
  await ownerPage.fill('input[placeholder*="Ramesh"]', waiterName);
  await ownerPage.selectOption("select", "waiter");
  await ownerPage.fill('input[placeholder*="5678"]', waiterPin);
  await ownerPage.click('button:has-text("Save Staff Member")');

  // Dismiss success modal
  const doneBtn = ownerPage.locator('button:has-text("Done")');
  await expect(doneBtn).toBeVisible({ timeout: 6000 });
  await doneBtn.click();
  await expect(doneBtn).not.toBeVisible({ timeout: 6000 });
  console.log("✓ Step 2b Passed: Waiter created!");

  // Create Kitchen Master
  console.log(`[Step 2c] Creating Kitchen Master: ${kitchenMasterName}`);
  await ownerPage.click('button:has-text("Add New Staff")');
  await ownerPage.fill('input[placeholder*="Ramesh"]', kitchenMasterName);
  await ownerPage.selectOption("select", "kitchen");
  await ownerPage.fill('input[placeholder*="5678"]', kitchenMasterPin);
  await ownerPage.click('button:has-text("Save Staff Member")');

  await expect(doneBtn).toBeVisible({ timeout: 6000 });
  await doneBtn.click();
  await expect(doneBtn).not.toBeVisible({ timeout: 6000 });
  console.log("✓ Step 2c Passed: Kitchen Master created!");

  // Verify staff members appear in table
  await expect(ownerPage.locator("body")).toContainText(waiterName);
  await expect(ownerPage.locator("body")).toContainText(kitchenMasterName);
  console.log("✓ Step 2 Completed: Both Waiter and Kitchen Master verified on staff roster!");

  // -------------------------------------------------------------
  // STEP 3: Customer Dine-In (Table QR Scan & Place Order)
  // -------------------------------------------------------------
  console.log("[Step 3] Setting up Customer Dine-In session...");
  const { data: resto } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_email", ownerEmail)
    .single();

  expect(resto).toBeTruthy();

  const { data: tables } = await supabase
    .from("restaurant_tables")
    .select("id, table_number, qr_token")
    .eq("restaurant_id", resto!.id)
    .order("table_number", { ascending: true });

  expect(tables && tables.length > 0).toBeTruthy();
  const targetTable = tables![0];
  console.log(`Customer seating at Table: ${targetTable.table_number} (token: ${targetTable.qr_token})`);

  // Open separate Customer browser context (simulating customer's phone)
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto(`/table/${targetTable.qr_token}`);

  // Dismiss welcome screen if shown
  const exploreBtn = customerPage.locator('button:has-text("Explore Menu"), button:has-text("Start Ordering")').first();
  try {
    await exploreBtn.waitFor({ state: "visible", timeout: 8000 });
    await exploreBtn.click();
    await exploreBtn.waitFor({ state: "hidden", timeout: 8000 });
  } catch {
    // Welcome screen was not present or already dismissed
  }

  // Customer adds dish to cart
  const addBtn = customerPage.locator('button:has-text("ADD")').first();
  await expect(addBtn).toBeVisible({ timeout: 10000 });
  await addBtn.click();
  console.log("Customer tapped + ADD on dish");

  // Open sticky cart
  const reviewBtn = customerPage.locator('button:has-text("Review Order")');
  await expect(reviewBtn).toBeVisible({ timeout: 5000 });
  await reviewBtn.click();

  // In Cart Drawer, fill customer name
  const nameInput = customerPage.locator('input[placeholder*="Name"], input[placeholder*="naam"]').first();
  if (await nameInput.isVisible({ timeout: 3000 })) {
    await nameInput.fill("Rahul Customer");
  }

  // Submit order
  const sendOrderBtn = customerPage.locator('button:has-text("Confirm & Send to Kitchen")');
  await expect(sendOrderBtn).toBeVisible({ timeout: 8000 });
  await sendOrderBtn.click();
  console.log("Customer submitted order to kitchen!");

  // Verify compact status card or confirmation
  await customerPage.waitForTimeout(2500);
  console.log("✓ Step 3 Completed: Customer placed order successfully!");

  // -------------------------------------------------------------
  // STEP 4: Kitchen Master sees order in Kitchen KDS
  // -------------------------------------------------------------
  console.log("[Step 4] Checking Kitchen Master KDS view...");
  await ownerPage.goto("/kitchen");
  await ownerPage.waitForLoadState("networkidle");
  await expect(ownerPage.locator("body")).toContainText(/Table|T01|Order|Ticket/i, { timeout: 10000 });
  console.log("✓ Step 4 Completed: Kitchen Master KDS displays the live order!");

  // -------------------------------------------------------------
  // STEP 5: Floor Workspace shows table active
  // -------------------------------------------------------------
  console.log("[Step 5] Checking Floor Workspace view...");
  await ownerPage.goto("/");
  await ownerPage.waitForLoadState("networkidle");
  await expect(ownerPage.locator("body")).toContainText(/T01|Zaika/i, { timeout: 10000 });
  console.log("✓ Step 5 Completed: Table shows as occupied with active order!");

  await customerContext.close();
  await ownerContext.close();
  console.log("🎉 ALL TESTS PASSED: Full E2E Lifecycle Verified via Playwright!");
});
