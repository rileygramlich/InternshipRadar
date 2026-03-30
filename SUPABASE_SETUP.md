# Supabase Setup Guide

## Overview

This document describes how to set up the Supabase project for the Internship Radar application. Supabase provides a PostgreSQL database with built-in authentication, real-time capabilities, and auto-generated APIs.

## Prerequisites

- A GitHub account (for Supabase login)
- Access to the [Supabase Dashboard](https://app.supabase.com)

## Step 1: Create a Supabase Project

1. Go to [Supabase](https://supabase.com) and sign up/log in with GitHub
2. Click **"New Project"** on the dashboard
3. Fill in the project details:
    - **Name**: `InternshipRadar` (or similar)
    - **Database Password**: Create a strong password and save it securely
    - **Region**: Select the region closest to your users (e.g., `us-west-1` for North America)
    - **Pricing Plan**: Select **Free Tier**
4. Click **"Create New Project"** and wait for the project to be initialized (2-5 minutes)

## Step 2: Execute the SQL Schema

Once your project is created:

1. In the Supabase Dashboard, navigate to your project
2. Go to **SQL Editor** (left sidebar)
3. Click **"New Query"**
4. Copy the entire contents of [`backend/schema.sql`](../backend/schema.sql)
5. Paste into the SQL Editor
6. Click **"Run"** to execute the schema
7. Verify the following tables are created in the **Table Editor**:
    - `profiles`
    - `job_postings`
    - `applications`

## Step 3: Get Your API Keys

1. In the Supabase Dashboard, go to **Settings > API**
2. Copy the following values:
    - **Project URL**: Under "API URL"
    - **Anon Key**: Under "Project API keys > anon [public]"
    - **Service Role Key**: Under "Project API keys > service_role [secret]"

⚠️ **IMPORTANT**: The Service Role Key is sensitive! Never commit it or share it publicly.

## Step 4: Configure Local Environment

1. From the repository root, create a `.env.local` file (never commit this):
    ```bash
    cp frontend/.env.local.example .env.local
    ```
2. Fill in your actual API keys:

    ```
    NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
    ```

3. The root `.gitignore` now ignores all `.env*` files (including `frontend/.env.local`).

## Step 5: Test the Connection (Optional)

You can verify the database is working by querying it from your Next.js app:

```typescript
// In a Next.js API route or component
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// Test query
const { data, error } = await supabase.from("profiles").select("*").limit(1);

console.log("Connection test:", data, error);
```

## Database Schema Overview

### Profiles Table

Stores user information and preferences for matching jobs.

| Column                | Type      | Description                                        |
| --------------------- | --------- | -------------------------------------------------- |
| `id`                  | UUID      | Primary key                                        |
| `discord_webhook_url` | TEXT      | Webhook URL for Discord notifications              |
| `skills`              | TEXT[]    | Array of user skills (e.g., `['React', 'Python']`) |
| `location_preference` | TEXT      | Preferred work location                            |
| `created_at`          | TIMESTAMP | Record creation time                               |
| `updated_at`          | TIMESTAMP | Last update time                                   |

### Job Postings Table

Stores internship postings from various sources.

| Column        | Type      | Description             |
| ------------- | --------- | ----------------------- |
| `id`          | UUID      | Primary key             |
| `company`     | TEXT      | Company name            |
| `title`       | TEXT      | Job title               |
| `url`         | TEXT      | Link to the job posting |
| `description` | TEXT      | Full job description    |
| `created_at`  | TIMESTAMP | When job was added      |
| `updated_at`  | TIMESTAMP | Last update time        |

### Applications Table (Junction)

Tracks user applications and match scores between profiles and jobs.

| Column        | Type      | Description                                                               |
| ------------- | --------- | ------------------------------------------------------------------------- |
| `id`          | UUID      | Primary key                                                               |
| `profile_id`  | UUID      | Foreign key to `profiles`                                                 |
| `job_id`      | UUID      | Foreign key to `job_postings`                                             |
| `match_score` | NUMERIC   | Relevance score (0.00 to 100.00)                                          |
| `status`      | TEXT      | Application status (`saved`, `applied`, `interview`, `rejected`, `offer`) |
| `created_at`  | TIMESTAMP | When application was created                                              |
| `updated_at`  | TIMESTAMP | Last update time                                                          |

## Next Steps

- Connect the Next.js frontend to Supabase using the [`@supabase/supabase-js`](https://github.com/supabase/supabase-js) client library
- Set up n8n automation to periodically fetch job postings and calculate match scores
- Configure Discord webhooks for notifications
- Implement user authentication with Supabase Auth

## Troubleshooting

### "Connection refused" when connecting to Supabase

- Verify your Project URL and API keys are correct
- Check that your IP is not blocked by Supabase firewall (unlikely on free tier)
- Ensure the `.env.local` file is being read by your Next.js app

### Tables not appearing in SQL Editor

- Refresh the page (F5)
- Check the SQL execution output for any error messages
- Verify Row Level Security (RLS) policies are not blocking access

### Permission denied errors

- RLS policies are enabled by default. Make sure you're authenticated before querying
- For public access, disable RLS on specific tables (Settings > Authentication > Policies)

## References

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Supabase JavaScript Client Library](https://supabase.com/docs/reference/javascript/introduction)
