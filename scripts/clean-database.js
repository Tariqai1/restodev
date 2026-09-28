const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment or .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function cleanDatabase() {
  console.log('--- STARTING COMPLETE DATABASE CLEANUP ---');

  // 1. Delete order_items
  const { error: oiErr } = await supabase
    .from('order_items')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('1. order_items deleted:', oiErr ? oiErr.message : 'OK');

  // 2. Delete bills
  const { error: bErr } = await supabase
    .from('bills')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('2. bills deleted:', bErr ? bErr.message : 'OK');

  // 3. Delete orders
  const { error: oErr } = await supabase
    .from('orders')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('3. orders deleted:', oErr ? oErr.message : 'OK');

  // 4. Delete menu_items
  const { error: miErr } = await supabase
    .from('menu_items')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('4. menu_items deleted:', miErr ? miErr.message : 'OK');

  // 5. Delete menu_categories
  const { error: mcErr } = await supabase
    .from('menu_categories')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('5. menu_categories deleted:', mcErr ? mcErr.message : 'OK');

  // 6. Delete restaurant_tables
  const { error: rtErr } = await supabase
    .from('restaurant_tables')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('6. restaurant_tables deleted:', rtErr ? rtErr.message : 'OK');

  // 7. Delete restaurants
  const { error: rErr } = await supabase
    .from('restaurants')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('7. restaurants deleted:', rErr ? rErr.message : 'OK');

  // 7b. Delete medication_logs and medications if exists
  try {
    await supabase.from('medication_logs').delete().neq('id', 0);
    await supabase.from('medications').delete().neq('id', 0);
  } catch (_) {}

  // 8. Delete public.users except super admin (tariqfsd9@gmail.com, tarique@gmail.com)
  const { error: puErr } = await supabase
    .from('users')
    .delete()
    .not('email', 'in', '("tariqfsd9@gmail.com","tarique@gmail.com")');
  console.log('8. public.users deleted (except super admin):', puErr ? puErr.message : 'OK');

  // 9. Delete auth.users except super admin
  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
  const keepEmails = ['tariqfsd9@gmail.com', 'tarique@gmail.com'];
  if (userList?.users) {
    for (const u of userList.users) {
      const email = (u.email || '').toLowerCase().trim();
      if (!keepEmails.includes(email)) {
        const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
        console.log(`9. Deleted auth user: ${u.email} (${u.id}):`, delErr ? delErr.message : 'OK');
      } else {
        console.log(`   ⭐ KEPT Super Admin User: ${u.email} (${u.id})`);
      }
    }
  }

  // 10. Clean platform-state.json
  try {
    const statePath = 'data/platform-state.json';
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
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
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
      console.log('10. Cleaned data/platform-state.json: OK');
    }
  } catch (err) {
    console.error('Error resetting platform-state:', err);
  }

  console.log('--- DATABASE CLEANUP SUCCESSFULLY COMPLETED ---');
}

cleanDatabase();
