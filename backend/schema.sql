-- Supabase Database Schema for Internship Radar
-- This is the core Entity-Relationship structure for users and job postings

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable ARRAY type support (Arrays are natively supported in PostgreSQL)

-- ============================================================================
-- 1. PROFILES TABLE
-- Stores user information and preferences
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discord_webhook_url TEXT,
  skills TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of skills (e.g., {'Python', 'React', 'Node.js'})
  location_preference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on created_at for efficient querying
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

-- ============================================================================
-- 2. JOB_POSTINGS TABLE
-- Stores internship postings from various sources
-- ============================================================================
CREATE TABLE job_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient searching
CREATE INDEX idx_job_postings_company ON job_postings(company);
CREATE INDEX idx_job_postings_title ON job_postings(title);
CREATE INDEX idx_job_postings_created_at ON job_postings(created_at);

-- ============================================================================
-- 3. APPLICATIONS TABLE (Junction Table)
-- Tracks the relationship between profiles and job postings
-- Stores application status and match scores
-- ============================================================================
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  match_score NUMERIC(5, 2) DEFAULT 0.00, -- Match score as percentage (0.00 - 100.00)
  status TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'applied', 'interview', 'rejected', 'offer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, job_id) -- Ensure a user can't apply to the same job twice
);

-- Create indexes for efficient querying
CREATE INDEX idx_applications_profile_id ON applications(profile_id);
CREATE INDEX idx_applications_job_id ON applications(job_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_match_score ON applications(match_score DESC);
CREATE INDEX idx_applications_created_at ON applications(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Optional but recommended for production
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own profile
CREATE POLICY profiles_self_access ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id);

-- Policy: All authenticated users can read job postings
CREATE POLICY job_postings_read_all ON job_postings
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can only view and manage their own applications
CREATE POLICY applications_self_access ON applications
  FOR ALL
  TO authenticated
  USING (auth.uid() = profile_id);

-- ============================================================================
-- SAMPLE DATA (Optional - for development/testing)
-- ============================================================================
-- You can uncomment these lines to seed test data

-- INSERT INTO profiles (discord_webhook_url, skills, location_preference)
-- VALUES (
--   'https://discordapp.com/api/webhooks/USER_ID/TOKEN',
--   ARRAY['React', 'Node.js', 'Python', 'PostgreSQL'],
--   'Calgary, AB'
-- );

-- INSERT INTO job_postings (company, title, url, description)
-- VALUES (
--   'Tech Corp Inc',
--   'Full Stack Internship',
--   'https://example.com/job/1',
--   'Looking for passionate interns with web development experience...'
-- );
