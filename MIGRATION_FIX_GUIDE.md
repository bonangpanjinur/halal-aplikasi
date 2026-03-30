# Fix Guide: "could not find the pic_id column of shared_links in the schema cache"

## Problem Summary

The application is trying to use a `pic_id` column in the `shared_links` table, but this column doesn't exist in your Supabase database. This causes the error:

```
could not find the pic_id column of shared_links in the schema cache
```

## Root Cause

The migration file `20260324000000_add_pic_and_platform_fee.sql` exists in the repository but **has not been applied** to your Supabase database.

### Evidence:
- ✅ Frontend code uses `pic_id` (ShareLinks.tsx, PublicForm.tsx)
- ✅ TypeScript types define `pic_id` (types.ts)
- ✅ Migration SQL exists (20260324000000_add_pic_and_platform_fee.sql)
- ❌ But the column is missing from the actual database

## Solution

### Method 1: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar

3. **Run the migration**
   - Create a new query and paste:
   ```sql
   -- Add pic_id to shared_links
   ALTER TABLE public.shared_links 
   ADD COLUMN pic_id uuid REFERENCES public.profiles(id);

   -- Add platform_fee_per_entry to profiles
   ALTER TABLE public.profiles 
   ADD COLUMN platform_fee_per_entry numeric DEFAULT 0;

   -- Add comments for documentation
   COMMENT ON COLUMN public.shared_links.pic_id IS 'The Person In Charge (PIC) assigned to this share link';
   COMMENT ON COLUMN public.profiles.platform_fee_per_entry IS 'Custom platform fee per entry for this owner';
   ```

4. **Refresh PostgREST Schema Cache**
   - Create another query and run:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

5. **Verify**
   - The error should be gone
   - Try creating a new share link with PIC selection

### Method 2: Using Supabase CLI

1. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   ```

2. **Link your project**
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Push migrations**
   ```bash
   supabase db push
   ```

4. **Verify**
   - Check that the migration was applied successfully
   - The error should be resolved

### Method 3: Manual SQL via psql (Advanced)

If you have direct database access:

```bash
psql "postgresql://user:password@host:5432/postgres" -c "
ALTER TABLE public.shared_links 
ADD COLUMN IF NOT EXISTS pic_id uuid REFERENCES public.profiles(id);

NOTIFY pgrst, 'reload schema';
"
```

## What This Migration Does

1. **Adds `pic_id` column** to `shared_links` table
   - Type: `uuid` (references profiles.id)
   - Allows NULL values (PIC is optional)
   - Foreign key constraint ensures referential integrity

2. **Adds `platform_fee_per_entry` column** to `profiles` table
   - Type: `numeric` with default value 0
   - Used for custom billing per profile

## Features Enabled After Migration

Once the migration is applied:

✅ **Create Share Links with PIC**
- When creating a new share link, you can select a Person In Charge (PIC)

✅ **Update PIC on Existing Links**
- Edit button allows changing the assigned PIC

✅ **Public Form Shows PIC**
- When users access the form via share link, they see who is responsible

✅ **PIC Tracking**
- Data entries are tracked with the assigned PIC information

## Troubleshooting

### Still getting the error after running the migration?

1. **Clear browser cache**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

2. **Verify column was created**
   - In Supabase Dashboard → Table Editor
   - Select `shared_links` table
   - Check if `pic_id` column exists

3. **Check for errors in migration**
   - Look at Supabase Dashboard → Database → Migrations
   - Verify the migration status

4. **Restart the application**
   - Stop the dev server and restart it

### Column already exists error?

If you get an error like "column already exists", the migration may have already been applied. Try:

```sql
-- Check if column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name='shared_links' AND column_name='pic_id';
```

If it exists, just refresh the schema cache:
```sql
NOTIFY pgrst, 'reload schema';
```

## Files Modified

- `supabase/migrations/20260324000000_add_pic_and_platform_fee.sql` - Migration definition
- `src/pages/ShareLinks.tsx` - PIC selection UI
- `src/pages/PublicForm.tsx` - PIC display in public form
- `src/integrations/supabase/types.ts` - TypeScript types with pic_id

## Related Documentation

- [Supabase Migrations](https://supabase.com/docs/guides/cli/local-development)
- [PostgREST Schema Cache](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
