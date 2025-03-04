# NutriScan AI

## How to Access Admin Panel

To access the admin panel, follow these steps:

1. First, make sure you're registered and logged in with an admin account.
2. Set admin permissions for your account by running this SQL query in Supabase SQL Editor:
   ```sql
   UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID';

