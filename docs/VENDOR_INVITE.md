# Vendor Invite & Contact Management

This document describes how to manage vendor invites and update vendor contact information in GridMind Capital.

## Overview

The vendor invite system allows you to:
- Issue invites to vendor representatives with subcontractor portal access
- Update vendor contact emails on purchase orders (with audit trail)
- Re-issue invites to new email addresses when contacts change
- Grant vendors access to relevant projects

## Data Model

### Purchase Orders (`purchase_orders` table)
- `po_number`: Purchase Order identifier (e.g., "PO-0002")
- `vendor_name`: Vendor name (e.g., "Petra Solar")
- `vendor_contact_email`: Primary contact email
- `vendor_contact_email_updated_at`: Timestamp of last email update
- `vendor_contact_email_updated_by`: User/system that made the change

### External Access (`external_access` table)
- Links a user (profile) to a project with a specific role
- `user_id`: User/vendor representative ID
- `project_id`: Project they have access to
- `organization_name`: Vendor organization name
- `revoked_at`: When access was revoked (if applicable)

### Profiles (`profiles` table)
- `role`: User role, including `subcontractor` for vendors
- `is_active`: Whether the user can log in

## How to Re-Issue a Vendor Invite

### Scenario
Petra Solar's procurement contact has changed from `procurement@petrasolar.jo` to `maher@tek.jo`. You need to:
1. Update the vendor contact email on PO-0002
2. Send an invite to the new email address
3. Grant portal access to the new user

### Method 1: Using the CLI Script (Recommended)

```bash
npx ts-node scripts/reinvite-vendor.ts \
  --po PO-0002 \
  --vendor "Petra Solar" \
  --email maher@tek.jo \
  --old-email procurement@petrasolar.jo
```

This script will:
1. ✓ Find PO-0002 and log the current contact email
2. ✓ Update `purchase_orders.vendor_contact_email` to `maher@tek.jo`
3. ✓ Create or update the user record for `maher@tek.jo`
4. ✓ Send an invite email (if SMTP is configured)
5. ✓ Generate a fallback magic link for copy/share
6. ✓ Grant project access to the user
7. ✓ Display a summary with the magic link

### Method 2: Using Server Action (Programmatic)

In a Next.js server action or API route:

```typescript
import { reissueVendorInvite } from '@/app/actions/procurement'

const result = await reissueVendorInvite({
  poNumber: 'PO-0002',
  vendorName: 'Petra Solar',
  newEmail: 'maher@tek.jo',
  oldEmail: 'procurement@petrasolar.jo',
  siteUrl: 'https://gridmind.local', // or production URL
})

if (result.error) {
  console.error('Invite failed:', result.error)
} else {
  console.log('Invite sent. Fallback link:', result.inviteLink)
}
```

### Method 3: Just Update the Email (No Invite)

If you only need to update the contact email record without sending a new invite:

```typescript
import { updateVendorContactEmail } from '@/app/actions/procurement'

const result = await updateVendorContactEmail({
  poNumber: 'PO-0002',
  newEmail: 'maher@tek.jo',
  oldEmail: 'procurement@petrasolar.jo', // optional, for reference
})
```

## Audit Trail

Every time a vendor contact email is updated, the system records:
- **When**: `vendor_contact_email_updated_at` timestamp
- **Who**: `vendor_contact_email_updated_by` (user/system making the change)
- **What**: Previous and new email addresses (visible in audit logs)

This ensures you have a complete history of contact changes for compliance and dispute resolution.

## Vendor Portal Access

Once invited, vendors receive:
1. **Email Invite** (if SMTP configured): Contains a magic link to sign up
2. **Fallback Link** (always available): Can be shared via Slack/Teams if email fails
3. **Portal Access**: After signing up, they access `/portal` to:
   - View their purchase orders
   - Submit documentation
   - Respond to RFQs (if applicable)

## Revoking Vendor Access

To revoke a vendor's access:

```typescript
import { revokeProjectAccess } from '@/app/actions/external-access'

await revokeProjectAccess({
  userId: 'vendor-user-id',
  projectId: 'project-id',
})
```

This sets `external_access.revoked_at` to the current timestamp, blocking access immediately.

## Common Issues

**Q: Vendor didn't receive the email**
- A: If email/SMTP is not configured, the invite is created but no email is sent. Use the fallback link from the CLI output.

**Q: User already exists for the email**
- A: The system updates their existing record and re-grants project access. No duplicate is created.

**Q: I need to change the email again later**
- A: Just run the reinvite script with the new email. The system tracks all changes.

## Integration with Procurement Cockpit

The Procurement Cockpit (`/procurement`) shows vendors aggregated from all active POs and RFQs. Clicking on a vendor's card could eventually show:
- Contact information (with the updated email)
- Invite status
- Portal access history
- Document submissions
- Performance metrics

(This UI enhancement is not yet implemented but can be added to vendor cards.)
