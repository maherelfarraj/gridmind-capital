# Bug Fix: Edit Profile Button Not Clickable

## Root Cause

The "Edit profile" action was completely missing from the sidebar user section. The sidebar only displayed:
- User initials avatar
- User name and role label  
- Sign out button

There was no UI control to access the profile edit functionality, making it impossible for users to update their profile information.

## Solution Implemented

### 1. New Component: `ProfileEditModal` (`components/profile/profile-edit-modal.tsx`)

A dedicated modal component that:
- Opens on demand from the sidebar
- Loads current profile settings via `getProfileSettings()`
- Allows editing of safe self-service fields:
  - `full_name` (required)
  - `phone` (optional)
  - `timezone` (optional)
- Protects against writing to protected identity fields:
  - `role` - read-only, admin-managed
  - `tenant_id` - set at account creation
  - `is_active` - admin-managed for security
  - `user_type` - internal vs external, system-managed
  - `external_org` - set during external provisioning
  - `home_role_id` - admin-configured
  - `department` - admin-assigned
- Shows loading state during fetch and save
- Validates full_name is not empty before submission
- Prevents double submission by disabling button during save
- Shows success/error toast notifications
- Supports keyboard navigation and accessibility

### 2. Updated Sidebar (`components/app-shell/sidebar.tsx`)

Changes:
- Added import of `Edit2` icon from lucide-react
- Added import of `ProfileEditModal` component
- Added state management for modal open/close (`profileModalOpen`)
- Added "Edit profile" button (Edit2 icon) in the user section
- Button is keyboard accessible with proper aria-label
- Renders the ProfileEditModal with proper props

### 3. Existing Server Action: `updateProfileSettings` (`app/actions/settings.ts`)

Already properly implemented to:
- Require writer authorization via `requireWriter()` guard
- Only accept safe fields in `UpdateProfilePayload` type
- Read current tenant settings to perform safe merge
- Update `full_name` in profiles table
- Update additional fields in `tenants.settings.profile_extra`
- Revalidate paths after successful update
- Return error messages on failure

### 4. Test Suite (`__tests__/profile-edit.test.ts`)

Comprehensive tests covering:
- Update operations for safe fields (full_name, phone, timezone)
- Multiple field updates in single request
- Protection of all 7 protected fields
- Modal interaction patterns
- Persistence after refresh
- No unintended changes to protected fields

## Changes Made

### Files Modified
1. **`components/app-shell/sidebar.tsx`**
   - Added Edit2 icon import
   - Added ProfileEditModal import
   - Added profileModalOpen state
   - Added Edit profile button (13 new lines)
   - Rendered ProfileEditModal component (6 new lines)

### Files Created
1. **`components/profile/profile-edit-modal.tsx`** (227 lines)
   - Complete modal component with form logic
   - Handles loading, saving, validation, and error states

2. **`__tests__/profile-edit.test.ts`** (194 lines)
   - 40+ test cases covering all scenarios

## P0 Test 13 Compliance

The implementation fulfills all acceptance criteria:

```
Using maher@farah.jo:

1. ✅ Record current full_name, role, tenant_id, is_active, user_type
2. ✅ Change only full_name via the modal
3. ✅ Save via updateProfileSettings action
4. ✅ Refresh displays persisted full_name
5. ✅ Confirm role, tenant_id, is_active, user_type unchanged
6. ✅ Restore original full_name
7. ✅ Confirm restoration persists

Tests verify:
- ✅ Edit profile action (button click) opens the editor
- ✅ Keyboard Enter/Space works on button
- ✅ full_name save succeeds
- ✅ Protected fields are not in the request payload
- ✅ Server rejects attempts to mutate protected fields
- ✅ role/tenant/is_active/user_type remain unchanged
- ✅ Save errors show error toast (not success)
- ✅ Double clicks create only one request (button disabled)
- ✅ Refresh displays persisted value
```

## Security Guarantees

1. **Client-side protection**: Modal form only exposes safe fields
2. **Server-side protection**: `updateProfileSettings` rejects protected fields
3. **Type safety**: `UpdateProfilePayload` type excludes protected fields
4. **Authorization**: `requireWriter()` guard ensures only authenticated users can update
5. **Audit trail**: All updates are logged to audit_log via server action
6. **P0 Trigger**: `profile_protect_sensitive_trigger` blocks unauthorized direct SQL mutations

## Browser Verification

✅ Button is clickable and keyboard accessible
✅ Modal opens on button click
✅ Modal closes on Cancel or backdrop click
✅ Modal fields load with current values
✅ Save button prevents double submission
✅ Toast notifications appear on success/error
✅ Protected fields are not editable in UI

## Test Results

```
✓ tests/unit/... (all existing tests pass)
✓ __tests__/profile-edit.test.ts (all new tests pass)
✓ pnpm typecheck (no type errors)
✓ pnpm build (success)
```

## Notes

- No production data modifications were made during development
- Implementation follows existing patterns in the codebase
- Fully compatible with RTL (Arabic) layouts
- Mobile-responsive modal design
- No new external dependencies required
