# Supabase Setup Checklist & Acceptance Criteria

## Overview

This document covers the setup and configuration of the Supabase database for the Internship Radar project, serving as the single source of truth for the application and n8n automation.

---

## Acceptance Criteria Status

### ✅ 1. Create a new Supabase project (Free Tier)

**What to do:**

1. Visit [Supabase.com](https://supabase.com)
2. Sign up or log in with GitHub
3. Click "New Project"
4. Configure:
    - Project Name: `InternshipRadar`
    - Database Password: Create a secure password
    - Region: Choose closest to users (e.g., `us-west-1`)
    - Plan: **Free Tier**
5. Wait for initialization (2-5 minutes)

**Verification:**

- [ ] Project appears in Supabase Dashboard
- [ ] Project status shows "Available"
- [ ] Can access SQL Editor and Table Editor

---

### ✅ 2. Execute SQL to create the profiles table

**What to do:**

1. In Supabase Dashboard → SQL Editor
2. Create new query
3. Copy and execute the `profiles` table schema from [`backend/schema.sql`](backend/schema.sql)

**Schema Details:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (Primary Key) | Auto-generated |
| `discord_webhook_url` | TEXT | Optional webhook for Discord notifications |
| `skills` | TEXT[] (Array) | Skills array (e.g., `['React', 'Python']`) |
| `location_preference` | TEXT | Location preference for job matching |
| `created_at` | TIMESTAMP | Auto-set to current time |
| `updated_at` | TIMESTAMP | Auto-set to current time |

**Indexes Created:**

- `idx_profiles_created_at` on `created_at` column

**Verification:**

- [ ] Table appears in Settings > Database > Tables
- [ ] All 5 columns are present with correct types
- [ ] Indexes are created

---

### ✅ 3. Execute SQL to create the job_postings table

**What to do:**

1. In Supabase Dashboard → SQL Editor
2. Create new query
3. Copy and execute the `job_postings` table schema from [`backend/schema.sql`](backend/schema.sql)

**Schema Details:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (Primary Key) | Auto-generated |
| `company` | TEXT (NOT NULL) | Company name |
| `title` | TEXT (NOT NULL) | Job title |
| `url` | TEXT | Link to job posting |
| `description` | TEXT | Full job description |
| `created_at` | TIMESTAMP | When added to system |
| `updated_at` | TIMESTAMP | When last updated |

**Indexes Created:**

- `idx_job_postings_company` on `company`
- `idx_job_postings_title` on `title`
- `idx_job_postings_created_at` on `created_at`

**Verification:**

- [ ] Table appears in Table Editor
- [ ] All 7 columns present with correct types
- [ ] Indexes created for efficient searching

---

### ✅ 4. Execute SQL to create the applications junction table

**What to do:**

1. In Supabase Dashboard → SQL Editor
2. Create new query
3. Copy and execute the `applications` table schema from [`backend/schema.sql`](backend/schema.sql)

**Schema Details:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (Primary Key) | Auto-generated |
| `profile_id` | UUID (Foreign Key) | References `profiles.id` |
| `job_id` | UUID (Foreign Key) | References `job_postings.id` |
| `match_score` | NUMERIC(5,2) | 0.00 - 100.00 percentage |
| `status` | TEXT (Enum) | One of: `saved`, `applied`, `interview`, `rejected`, `offer` |
| `created_at` | TIMESTAMP | When application created |
| `updated_at` | TIMESTAMP | When last updated |

**Constraints:**

- `UNIQUE(profile_id, job_id)`: Prevents duplicate applications
- Foreign keys with `ON DELETE CASCADE`: Auto-cleanup when profiles/jobs deleted
- `CHECK` constraint on status: Enforces valid status values

**Indexes Created:**

- `idx_applications_profile_id` on `profile_id`
- `idx_applications_job_id` on `job_id`
- `idx_applications_status` on `status`
- `idx_applications_match_score` on `match_score DESC`
- `idx_applications_created_at` on `created_at`

**Verification:**

- [ ] Table appears in Table Editor
- [ ] Foreign key relationships visible
- [ ] UNIQUE constraint prevents duplicate entries
- [ ] All 5 indexes created

---

### ✅ 5. Add connection strings/API keys to .env.local template

**What has been created:**

1. **[`frontend/.env.local`](frontend/.env.local)** - Local environment file (NOT committed)
    - Contains placeholder keys for local development
    - This file should NOT be committed to Git
    - Add to `.gitignore` (already done in `frontend/.gitignore`)

2. **[`frontend/.env.local.example`](frontend/.env.local.example)** - Template (CAN be committed)
    - Shows required variables and their format
    - Can be shared with team members
    - Instructions for filling in actual values

3. **[`.env.local` at root](... /.env.local)** - Fallback root config
    - Alternative if environment variables needed at project root

**Required Environment Variables:**

```env
# From Supabase Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# For n8n automation integration
N8N_WEBHOOK_URL=https://your-n8n-instance.ngrok.io/webhook/internship-radar

# For Discord integration
DISCORD_BOT_TOKEN=your-discord-bot-token-here
```

**How to Get API Keys:**

1. In Supabase Dashboard:
2. Go to **Settings > API**
3. Under "Project API keys":
    - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
    - Copy **anon [public]** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - Copy **service_role [secret]** → `SUPABASE_SERVICE_ROLE_KEY`

**Security Notes:**

- ⚠️ **PUBLIC keys** (`NEXT_PUBLIC_*`): Safe to expose, used in browser
- ⚠️ **SECRET keys** (`SUPABASE_SERVICE_ROLE_KEY`): Keep private!
    - Only use on backend
    - Never commit to Git
    - Never expose in frontend code
- `.gitignore` already includes `.env.local` in `frontend/.gitignore`

**Verification:**

- [ ] `.env.local` file exists and is in `.gitignore`
- [ ] `.env.local.example` exists with template format
- [ ] API keys from Supabase Dashboard are filled in locally
- [ ] `git status` does not show `.env.local`

---

## Files Created

### Database

- **[`backend/schema.sql`](backend/schema.sql)**
    - Complete SQL DDL for all tables
    - Includes indexes, constraints, and Row Level Security (RLS) policies
    - Ready to execute in Supabase SQL Editor

### TypeScript/JavaScript

- **[`backend/supabaseClient.ts`](backend/supabaseClient.ts)**
    - Supabase client initialization
    - Helper functions for all CRUD operations
    - Common query patterns for profiles, jobs, and applications

### Documentation

- **[`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)**
    - Comprehensive step-by-step setup guide
    - Database schema overview
    - Troubleshooting common issues

- **[`SUPABASE_CHECKLIST.md`](SUPABASE_CHECKLIST.md)** (this file)
    - Acceptance criteria verification
    - Setup instructions
    - Security guidelines

### Configuration

- **[`frontend/.env.local`](frontend/.env.local)**
    - Local environment variables (NOT committed)
    - Fill with actual Supabase API keys

- **[`frontend/.env.local.example`](frontend/.env.local.example)**
    - Template showing required variables
    - Example format and descriptions

---

## Database Architecture

### Entity Relationship Diagram

```
┌─────────────────┐
│    profiles     │
├─────────────────┤
│ id (PK)         │
│ discord_webhook │
│ skills (array)  │
│ location_pref   │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │ 1
         │
         │ N
         │
┌────────┴──────────────┐
│   applications        │
├───────────────────────┤
│ id (PK)               │
│ profile_id (FK) ──────┼──→ profiles.id
│ job_id (FK) ──────────┼──→ job_postings.id
│ match_score           │
│ status (enum)         │
│ created_at            │
│ updated_at            │
└────────┬──────────────┘
         │ N
         │
         │ 1
         │
┌────────┴──────────────┐
│   job_postings        │
├───────────────────────┤
│ id (PK)               │
│ company               │
│ title                 │
│ url                   │
│ description           │
│ created_at            │
│ updated_at            │
└───────────────────────┘
```

### Data Flow

1. **User creates profile** → Stored in `profiles` table
2. **n8n fetches job postings** → Stored in `job_postings` table
3. **Matching algorithm runs** → Calculates match scores
4. **Application record created** → Stores in `applications` table with score
5. **Discord webhook triggered** → Sends notification via `discord_webhook_url`
6. **User updates status** → Application status changes in `applications` table

---

## Next Steps

After completing this checklist:

1. **[Install Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)**

    ```bash
    cd frontend
    npm install @supabase/supabase-js
    ```

2. **Set up authentication** (if not already done)
    - Enable email/password auth in Supabase Dashboard
    - Configure redirect URLs for your app

3. **Implement n8n automation**
    - Connect n8n to Supabase
    - Create job fetching and matching workflow
    - Configure Discord notifications

4. **Create React components**
    - Profile management component
    - Job listings component
    - Application tracker component

---

## References

- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Supabase JS Client**: https://supabase.com/docs/reference/javascript
- **n8n Documentation**: https://docs.n8n.io
- **Discord Webhooks**: https://discord.com/developers/docs/resources/webhook

---

## Support

For issues:

1. Check [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) Troubleshooting section
2. Review Supabase Dashboard → Logs for database errors
3. Test queries in Supabase SQL Editor before using in code
