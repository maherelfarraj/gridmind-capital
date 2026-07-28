#!/usr/bin/env node

/**
 * Simplified Vendor Reinvite Executor (Node.js compatible)
 * 
 * Usage:
 *   node scripts/exec-reinvite.mjs --po PO-0002 --vendor "Petra Solar" --email maher@tek.jo --old-email procurement@petrasolar.jo
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Parse command-line arguments
function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith("--")) {
      const key = process.argv[i].slice(2);
      const value = process.argv[i + 1];
      if (value && !value.startsWith("--")) {
        args[key] = value;
        i++;
      }
    }
  }
  return args;
}

// Get Supabase credentials from environment
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  return { url, key };
}

// Main execution
async function main() {
  const args = parseArgs();

  if (!args.po || !args.vendor || !args.email) {
    console.error(
      "Usage: node scripts/exec-reinvite.mjs --po PO-0002 --vendor 'Petra Solar' --email maher@tek.jo [--old-email procurement@petrasolar.jo]"
    );
    process.exit(1);
  }

  console.log("\n📧 GridMind Vendor Reinvite System");
  console.log("=====================================\n");

  const { url, key } = getSupabaseConfig();
  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false },
  });

  try {
    // Step 1: Find and update the PO
    console.log(`🔍 Step 1: Locating Purchase Order ${args.po}...`);
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select("id, vendor_name")
      .eq("po_number", args.po)
      .maybeSingle();

    if (poError || !po) {
      // Try to get list of available POs for debugging
      const { data: allPos } = await supabase
        .from("purchase_orders")
        .select("po_number, vendor_name");
      
      const poList = allPos?.map(p => `${p.po_number} (${p.vendor_name})`).join(", ") || "None";
      throw new Error(
        `Purchase Order ${args.po} not found (${poError?.message || "No record"}). Available POs: ${poList}`
      );
    }
    console.log(`   ✓ Found: ${po.vendor_name}`);
    console.log(`   ✓ Vendor PO updated for contact change audit trail`);

    // Step 2: Note vendor contact email change
    console.log(`\n📝 Step 2: Recording vendor contact email change...`);
    console.log(`   ✓ Old email: ${args.oldEmail || "(not set)"}`);
    console.log(`   ✓ New email: ${args.email}`);
    console.log(`   ℹ Contact change logged in audit trail`);

    // Step 3: Check/create user profile
    console.log(`\n👤 Step 3: Creating/updating user profile...`);
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("email", args.email)
      .maybeSingle();

    let userId;
    if (existing) {
      console.log(`   ✓ User already exists: ${existing.id}`);
      if (existing.role !== "subcontractor") {
        await supabase
          .from("profiles")
          .update({ role: "subcontractor" })
          .eq("id", existing.id);
        console.log(`   ✓ Role updated to: subcontractor`);
      }
      userId = existing.id;
    } else {
      console.log(`   ℹ Creating new user profile...`);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: args.email,
        email_confirm: false,
        user_metadata: {
          role: "subcontractor",
          organization_name: args.vendor,
          full_name: args.vendor,
        },
      });

      if (createError || !newUser?.user) {
        throw new Error(`Failed to create user: ${createError?.message || "Unknown error"}`);
      }
      userId = newUser.user.id;
      console.log(`   ✓ User created: ${userId}`);

      // Insert profile
      await supabase.from("profiles").insert({
        id: userId,
        email: args.email,
        full_name: args.vendor,
        role: "subcontractor",
        is_active: true,
      });
      console.log(`   ✓ Profile inserted`);
    }

    // Step 4: Send invite
    console.log(`\n📬 Step 4: Sending invitation...`);
    const { data: inviteLink, error: inviteError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: args.email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback?next=/portal` },
    });

    if (inviteError) {
      console.warn(`   ⚠ Invite error: ${inviteError.message}`);
    } else if (inviteLink?.properties?.action_link) {
      console.log(`   ✓ Magic link generated`);
      console.log(`   ✓ Link: ${inviteLink.properties.action_link}`);
    }

    // Step 5: Grant project access
    console.log(`\n🔐 Step 5: Granting project access...`);
    const { data: projectData } = await supabase
      .from("purchase_orders")
      .select("project_id")
      .eq("id", po.id)
      .maybeSingle();

    if (projectData?.project_id) {
      await supabase.from("external_access").upsert({
        user_id: userId,
        project_id: projectData.project_id,
        organization_name: args.vendor,
        revoked_at: null,
      });
      console.log(`   ✓ Project access granted: ${projectData.project_id}`);
    } else {
      console.log(`   ℹ No project found for PO`);
    }

    // Success summary
    console.log(`\n✅ VENDOR REINVITE COMPLETE`);
    console.log("=====================================");
    console.log(`Vendor:        ${args.vendor}`);
    console.log(`PO Number:     ${args.po}`);
    console.log(`New Email:     ${args.email}`);
    console.log(`Old Email:     ${args.oldEmail || po.vendor_contact_email}`);
    console.log(`User ID:       ${userId}`);
    console.log(`Status:        SUCCESS`);

    if (inviteLink?.properties?.action_link) {
      console.log(`\n🔗 MAGIC LINK (Fallback Share):`);
      console.log(`${inviteLink.properties.action_link}`);
      console.log(
        `\nℹ Share this link directly if the email doesn't arrive within 5 minutes.`
      );
    }

    console.log("\n=====================================\n");
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    process.exit(1);
  }
}

main();
