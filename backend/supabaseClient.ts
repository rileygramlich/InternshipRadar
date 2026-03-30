// Supabase Client Setup and Common Operations
// This file demonstrates how to use Supabase in the Next.js application

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ============================================================================
// PROFILE OPERATIONS
// ============================================================================

/**
 * Create a new user profile
 */
export async function createProfile(
    discord_webhook_url: string,
    skills: string[],
    location_preference: string,
) {
    const { data, error } = await supabase
        .from("profiles")
        .insert([
            {
                discord_webhook_url,
                skills,
                location_preference,
            },
        ])
        .select();

    if (error) throw error;
    return data[0];
}

/**
 * Get a profile by ID
 */
export async function getProfile(profileId: string) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update a profile
 */
export async function updateProfile(
    profileId: string,
    updates: {
        discord_webhook_url?: string;
        skills?: string[];
        location_preference?: string;
    },
) {
    const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profileId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================================
// JOB POSTINGS OPERATIONS
// ============================================================================

/**
 * Create a new job posting (typically called by n8n automation)
 */
export async function createJobPosting(
    company: string,
    title: string,
    url: string,
    description: string,
) {
    const { data, error } = await supabase
        .from("job_postings")
        .insert([
            {
                company,
                title,
                url,
                description,
            },
        ])
        .select();

    if (error) throw error;
    return data[0];
}

/**
 * Get all job postings with pagination
 */
export async function getJobPostings(
    page: number = 0,
    pageSize: number = 20,
    searchQuery?: string,
) {
    let query = supabase.from("job_postings").select("*", { count: "exact" });

    if (searchQuery) {
        query = query.or(
            `company.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%`,
        );
    }

    const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    return { data, total: count };
}

/**
 * Get a single job posting
 */
export async function getJobPosting(jobId: string) {
    const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .eq("id", jobId)
        .single();

    if (error) throw error;
    return data;
}

// ============================================================================
// APPLICATION OPERATIONS
// ============================================================================

/**
 * Create a new application (when user applies to a job)
 */
export async function createApplication(
    profileId: string,
    jobId: string,
    match_score: number = 0,
    status: "saved" | "applied" | "interview" | "rejected" | "offer" = "saved",
) {
    const { data, error } = await supabase
        .from("applications")
        .insert([
            {
                profile_id: profileId,
                job_id: jobId,
                match_score,
                status,
            },
        ])
        .select();

    if (error) throw error;
    return data[0];
}

/**
 * Update application status
 */
export async function updateApplicationStatus(
    applicationId: string,
    status: "saved" | "applied" | "interview" | "rejected" | "offer",
) {
    const { data, error } = await supabase
        .from("applications")
        .update({ status })
        .eq("id", applicationId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get all applications for a profile
 */
export async function getProfileApplications(
    profileId: string,
    status?: string,
) {
    let query = supabase
        .from("applications")
        .select(
            `
        *,
        job_postings:job_id (
          id,
          company,
          title,
          url,
          description,
          created_at
        )
      `,
        )
        .eq("profile_id", profileId);

    if (status) {
        query = query.eq("status", status);
    }

    const { data, error } = await query.order("created_at", {
        ascending: false,
    });

    if (error) throw error;
    return data;
}

/**
 * Get jobs that match a profile (by location and skills)
 * Returns jobs sorted by match score
 */
export async function getMatchingJobs(profileId: string, limit: number = 10) {
    const { data, error } = await supabase
        .from("applications")
        .select(
            `
        *,
        job_postings:job_id (
          id,
          company,
          title,
          url,
          description
        )
      `,
        )
        .eq("profile_id", profileId)
        .order("match_score", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

/**
 * Batch update match scores (called by n8n automation)
 */
export async function updateMatchScores(
    updates: Array<{
        applicationId: string;
        matchScore: number;
    }>,
) {
    const promises = updates.map(({ applicationId, matchScore }) =>
        supabase
            .from("applications")
            .update({ match_score: matchScore })
            .eq("id", applicationId),
    );

    const results = await Promise.all(promises);
    const errors = results.filter((r) => r.error).map((r) => r.error);

    if (errors.length > 0) {
        throw new Error(
            `Failed to update match scores: ${errors.map((e) => e!.message).join(", ")}`,
        );
    }

    return results;
}

// ============================================================================
// CLEANUP / DELETION OPERATIONS
// ============================================================================

/**
 * Delete an application
 */
export async function deleteApplication(applicationId: string) {
    const { error } = await supabase
        .from("applications")
        .delete()
        .eq("id", applicationId);

    if (error) throw error;
}

/**
 * Delete a profile (cascade deletes applications)
 */
export async function deleteProfile(profileId: string) {
    const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileId);

    if (error) throw error;
}

export default supabase;
