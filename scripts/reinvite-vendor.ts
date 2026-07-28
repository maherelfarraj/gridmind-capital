#!/usr/bin/env node

/**
 * Vendor Reinvite CLI
 * 
 * Usage: 
 *   npx ts-node scripts/reinvite-vendor.ts --po PO-0002 --vendor "Petra Solar" --email maher@tek.jo --old-email procurement@petrasolar.jo
 * 
 * This script re-issues a vendor invite to a new email address and updates the vendor contact email
 * on the PO record for audit trail purposes.
 */

import { createAdminClient } from '../lib/supabase/admin'

interface Args {
  po: string
  vendor: string
  email: string
  oldEmail?: string
  siteUrl?: string
}

async function parseArgs(): Promise<Args> {
  const args: Record<string, string> = {}
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--')) {
      const key = process.argv[i].slice(2)
      const value = process.argv[i + 1]
      if (value && !value.startsWith('--')) {
        args[key] = value
        i++
      }
    }
  }

  if (!args.po || !args.vendor || !args.email) {
    console.error('Missing required arguments:')
    console.error('  --po <PO_NUMBER>       Purchase Order number (e.g., PO-0002)')
    console.error('  --vendor <VENDOR_NAME> Vendor name (e.g., "Petra Solar")')
    console.error('  --email <NEW_EMAIL>    New email address (e.g., maher@tek.jo)')
    console.error('  --old-email <EMAIL>    (Optional) Old email address for reference')
    console.error('  --site-url <URL>       (Optional) Site URL for invite link')
    process.exit(1)
  }

  return {
    po: args.po,
    vendor: args.vendor,
    email: args.email,
    oldEmail: args['old-email'],
    siteUrl: args['site-url'] || 'https://gridmind.local',
  }
}

async function reinviteVendor(args: Args) {
  try {
    const supabase = createAdminClient()

    console.log(`\n📧 Re-issuing vendor invite for ${args.vendor} (${args.po})`)
    console.log(`   Old email: ${args.oldEmail || '(not recorded)'}`)
    console.log(`   New email: ${args.email}`)

    // Step 1: Update vendor contact email on PO record
    console.log(`\n1️⃣  Updating vendor contact email on PO...`)
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, vendor_name, vendor_contact_email')
      .eq('po_number', args.po)
      .maybeSingle()

    if (poError || !po) {
      console.error(`   ❌ PO not found: ${args.po}`)
      process.exit(1)
    }

    console.log(`   ✓ Found PO: ${po.vendor_name} (${po.id.slice(0, 8)}...)`)
    console.log(`   ✓ Previous email: ${po.vendor_contact_email || '(none)'}`)

    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        vendor_contact_email: args.email,
        vendor_contact_email_updated_at: new Date().toISOString(),
      })
      .eq('id', po.id)

    if (updateError) {
      console.error(`   ❌ Failed to update: ${updateError.message}`)
      process.exit(1)
    }
    console.log(`   ✓ Updated to: ${args.email}`)

    // Step 2: Check for existing user or create new invite
    console.log(`\n2️⃣  Checking for existing user...`)
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('email', args.email)
      .maybeSingle()

    let userId: string
    if (existingUser) {
      console.log(`   ✓ User already exists: ${existingUser.email}`)
      if (existingUser.role !== 'subcontractor') {
        console.log(`   ℹ️  Updating role to subcontractor...`)
        await supabase
          .from('profiles')
          .update({ role: 'subcontractor' })
          .eq('id', existingUser.id)
      }
      userId = existingUser.id
    } else {
      console.log(`   ℹ️  Creating new user invite...`)
      const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
        args.email,
        {
          data: {
            role: 'subcontractor',
            organization_name: args.vendor,
            full_name: args.vendor,
          },
          redirectTo: `${args.siteUrl}/auth/callback?next=/portal`,
        },
      )

      if (inviteErr || !inviteData?.user) {
        console.error(`   ❌ Failed to invite: ${inviteErr?.message}`)
        process.exit(1)
      }
      userId = inviteData.user.id
      console.log(`   ✓ User created: ${userId.slice(0, 8)}...`)

      // Ensure profile row exists
      await supabase.from('profiles').upsert({
        id: userId,
        email: args.email,
        full_name: args.vendor,
        role: 'subcontractor',
        is_active: true,
      }, { onConflict: 'id', ignoreDuplicates: false })
    }

    // Step 3: Generate fallback magic link
    console.log(`\n3️⃣  Generating invite link...`)
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: args.email,
      options: { redirectTo: `${args.siteUrl}/auth/callback?next=/portal` },
    })

    if (linkData?.properties?.action_link) {
      console.log(`   ✓ Magic link ready (for copy/share if email fails)`)
    }

    // Step 4: Grant project access
    console.log(`\n4️⃣  Granting project access...`)
    const { data: poWithProject } = await supabase
      .from('purchase_orders')
      .select('project_id')
      .eq('po_number', args.po)
      .maybeSingle()

    if (poWithProject?.project_id) {
      await supabase.from('external_access').upsert({
        user_id: userId,
        project_id: poWithProject.project_id,
        organization_name: args.vendor,
        revoked_at: null,
      }, { onConflict: 'user_id,project_id', ignoreDuplicates: false })
      console.log(`   ✓ Project access granted`)
    }

    console.log(`\n✅ Vendor invite re-issued successfully!`)
    console.log(`\n📋 Summary:`)
    console.log(`   PO Number:    ${args.po}`)
    console.log(`   Vendor:       ${args.vendor}`)
    console.log(`   New Email:    ${args.email}`)
    console.log(`   Old Email:    ${args.oldEmail || '(not recorded)'}`)
    console.log(`   User ID:      ${userId.slice(0, 8)}...`)
    if (linkData?.properties?.action_link) {
      console.log(`   Invite Link:  ${linkData.properties.action_link}`)
    }
    console.log()
  } catch (error) {
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

// Main
async function main() {
  const args = await parseArgs()
  await reinviteVendor(args)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
