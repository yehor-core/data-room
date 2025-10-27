# Data Room Project - Complete Checklist & Troubleshooting

## Current Issues Summary

### ✅ Working
- ✓ User authentication (login/signup)
- ✓ Data room creation and listing
- ✓ Folder creation and listing
- ✓ File upload
- ✓ File viewing
- ✓ Navigation and routing
- ✓ Prisma database connections (fixed with singleton pattern)

### ❌ Not Working
- ✗ Delete folder (CORS preflight failure)
- ✗ Delete file (CORS preflight failure)
- ✗ Rename folder (CORS preflight failure)
- ✗ Rename file (CORS preflight failure)
- ✗ Invalid date display on file badges

## Issue #1: DELETE/PATCH Requests CORS Failure

### Problem
OPTIONS preflight requests for DELETE and PATCH methods are NOT reaching the backend handler at all.

### Evidence
- No logs in Vercel for OPTIONS requests
- Browser shows: "Response to preflight request doesn't pass access control check"
- GET/POST requests work perfectly

### Root Cause
**Vercel is blocking OPTIONS requests before they reach our serverless functions.**

This is a known Vercel limitation with dynamic routes using brackets `[id]`.

### Solution Options

#### Option A: Use Query Parameters Instead of Path Parameters (RECOMMENDED)
Change from:
```
DELETE /api/folders/[id]  ❌ Blocked by Vercel
```

To:
```
DELETE /api/folders?id=xxx  ✅ Works
```

**Files to modify:**
1. Backend: `api/folders.ts` - Accept `id` from query instead of path
2. Frontend: `frontend/src/lib/api.ts` - Change DELETE URLs to use query params

#### Option B: Create Separate Endpoint Files
Instead of dynamic routes, create explicit files:
```
api/folders-delete.ts
api/folders-update.ts
api/files-delete.ts
api/files-update.ts
```

#### Option C: Use Vercel Edge Functions
Migrate to Edge Functions which handle CORS better, but requires refactoring.

### Implementation for Option A (Recommended)

**Backend Changes:**

```typescript
// api/folders.ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ... CORS handling ...
  
  const { id } = req.query; // Get id from query, not path
  
  if (req.method === 'DELETE' && id) {
    // Handle delete with id from query
    const folder = await prisma.folder.delete({
      where: { id: id as string }
    });
    // ...
  }
  
  if (req.method === 'PATCH' && id) {
    // Handle update with id from query
    const { name } = req.body;
    const folder = await prisma.folder.update({
      where: { id: id as string },
      data: { name }
    });
    // ...
  }
}
```

**Frontend Changes:**

```typescript
// frontend/src/lib/api.ts or DataRoomView.tsx

// Change from:
api.delete(`/folders/${folderId}`)

// To:
api.delete(`/folders?id=${folderId}`)

// Change from:
api.patch(`/folders/${folderId}`, { name })

// To:
api.patch(`/folders?id=${folderId}`, { name })
```

## Issue #2: Invalid Date Display

### Problem
Files show "Invalid date" on badges.

### Root Cause
Date values from database are being serialized as strings (due to BigInt serialization), and `formatDate` function isn't handling all edge cases.

### Solution
The `formatDate` function in `frontend/src/lib/utils.ts` was already updated to handle this, but we need to ensure the backend is returning proper ISO date strings.

**Verify backend sends dates as ISO strings:**
```typescript
// In serializeBigInt function
if (obj instanceof Date) {
  return obj.toISOString();
}
```

## Complete Testing Checklist

### Authentication ✓
- [ ] Sign up new user
- [ ] Log in with existing user
- [ ] Log out
- [ ] Token persists on page refresh
- [ ] Unauthorized access redirects to login

### Data Rooms ✓
- [ ] Create new data room
- [ ] List all data rooms
- [ ] Click to enter data room
- [ ] Duplicate name prevention

### Folders
- [ ] Create folder (root level) ✓
- [ ] Create subfolder ✓
- [ ] View folder contents ✓
- [ ] Navigate into folder ✓
- [ ] Navigate back to parent ✓
- [ ] Delete folder ❌ (CORS issue)
- [ ] Rename folder ❌ (CORS issue)
- [ ] Duplicate name prevention ✓

### Files
- [ ] Upload file ✓
- [ ] View file (PDF) ✓
- [ ] Download file ✓
- [ ] List files in folder ✓
- [ ] Delete file ❌ (CORS issue)
- [ ] Rename file ❌ (CORS issue)
- [ ] Duplicate name handling ✓
- [ ] File size display ✓
- [ ] File date display ❌ (shows "Invalid date")

### UI/UX
- [ ] File tree shows correct structure ✓
- [ ] Files only show in their folders ✓
- [ ] Context menu (...) works ✓
- [ ] Breadcrumb navigation ✓
- [ ] Loading states ✓
- [ ] Error messages ✓
- [ ] Search functionality ✓

### Performance
- [ ] Fast page loads ✓
- [ ] No database connection errors ✓
- [ ] File uploads complete ✓
- [ ] No CORS errors for GET/POST ✓
- [ ] Consistent response times ✓

## Priority Action Items

### High Priority (Blocking Core Functionality)
1. **Fix DELETE/PATCH CORS Issue**
   - Implement Option A (query parameters) immediately
   - This will unblock folder/file deletion and renaming

### Medium Priority
2. **Fix Date Display**
   - Add ISO string serialization to backend
   - Verify formatDate handles all cases

3. **Test All Endpoints After CORS Fix**
   - Run through complete checklist
   - Verify all CRUD operations work

### Low Priority
4. **UI Polish**
   - Improve error messages
   - Add loading indicators
   - Better empty states

5. **Performance Optimization**
   - Monitor Prisma query performance
   - Add caching where appropriate
   - Optimize large file handling

## Debugging Steps

### When Something Doesn't Work:

1. **Check Browser Console**
   - Look for error messages
   - Check Network tab for failed requests
   - Verify request/response headers

2. **Check Vercel Logs**
   - Go to Vercel Dashboard → Functions → Logs
   - Look for request logs and errors
   - Check if request even reached the handler

3. **Check Database**
   - Verify data exists in Supabase
   - Check for orphaned records
   - Verify foreign keys are correct

4. **Check Environment Variables**
   - Verify all env vars are set in Vercel
   - Check DATABASE_URL has `?pgbouncer=true`
   - Verify JWT_SECRET is consistent

5. **Check CORS**
   - Verify origin matches exactly
   - Check for preflight OPTIONS request
   - Ensure all headers are set

## Quick Fixes Reference

### CORS Error
```
Access to XMLHttpRequest has been blocked by CORS policy
```
**Fix**: Use query parameters instead of path parameters for DELETE/PATCH

### Database Connection Error
```
Response from the Engine was empty
```
**Fix**: Already fixed with singleton pattern ✓

### 401 Unauthorized
```
{"error":"Unauthorized"}
```
**Fix**: Check token in localStorage, verify JWT_SECRET matches

### 500 Internal Server Error
**Fix**: Check Vercel logs for detailed error message

### File Not Found
```
File not found. Please re-upload the file.
```
**Fix**: Check file.filePath exists in database and Supabase storage

## Next Steps

1. **Implement Option A for CORS fix** (see above)
2. **Test all functionality** using checklist
3. **Fix date display** if still showing invalid
4. **Deploy and verify** everything works in production

This should resolve all current issues and provide a working application!
