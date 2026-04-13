// Supabase server-side client and data-access helpers for API routes.
// NOTE: This uses the service role key; do not import into client components.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
}

if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// ============================================================================
// PROFILE OPERATIONS
// ============================================================================

export async function listProfiles() {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

export async function createProfile(
    name: string,
    email: string,
    discord_webhook_url: string,
    skills: string[],
    location_preference: string,
    experience_level: string | null = null,
    remote_preference: boolean = false,
    about: string = "",
    profile_photo_url: string = "",
) {
    const { data, error } = await supabase
        .from("profiles")
        .insert([
            {
                name,
                email,
                discord_webhook_url,
                skills,
                location_preference,
                experience_level,
                remote_preference,
                about,
                profile_photo_url,
            },
        ])
        .select();

    if (error) throw error;
    return data[0];
}

export async function getProfile(profileId: string) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

    if (error) throw error;
    return data;
}

export async function updateProfile(
    profileId: string,
    updates: {
        name?: string;
        email?: string;
        discord_webhook_url?: string;
        skills?: string[];
        location_preference?: string;
        experience_level?: string;
        remote_preference?: boolean;
        about?: string;
        profile_photo_url?: string;
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

export async function deleteProfile(profileId: string) {
    const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileId);

    if (error) throw error;
}

// ============================================================================
// JOB POSTINGS OPERATIONS
// ============================================================================

export async function createJobPosting(
    company: string,
    title: string,
    url: string,
    description: string,
    tech_tags?: string[],
) {
    const { data, error } = await supabase
        .from("job_postings")
        .insert([
            {
                company,
                title,
                url,
                description,
                ...(tech_tags !== undefined ? { tech_tags } : {}),
            },
        ])
        .select();

    if (error) throw error;
    return data[0];
}

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

export async function getJobPosting(jobId: string) {
    const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .eq("id", jobId)
        .single();

    if (error) throw error;
    return data;
}

export async function updateJobPosting(
    jobId: string,
    updates: {
        company?: string;
        title?: string;
        url?: string;
        description?: string;
        tech_tags?: string[];
    },
) {
    const { data, error } = await supabase
        .from("job_postings")
        .update(updates)
        .eq("id", jobId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteJobPosting(jobId: string) {
    const { error } = await supabase
        .from("job_postings")
        .delete()
        .eq("id", jobId);

    if (error) throw error;
}

// ============================================================================
// APPLICATION OPERATIONS
// ============================================================================

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

export async function updateApplication(
    applicationId: string,
    updates: {
        status?: "saved" | "applied" | "interview" | "rejected" | "offer";
        match_score?: number;
    },
) {
    const { data, error } = await supabase
        .from("applications")
        .update(updates)
        .eq("id", applicationId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

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

export async function getApplicationById(applicationId: string) {
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
                    description,
                    created_at
                )
            `,
        )
        .eq("id", applicationId)
        .single();

    if (error) throw error;
    return data;
}

export async function listApplications(filters?: {
    profileId?: string;
    jobId?: string;
    status?: string;
}) {
    let query = supabase.from("applications").select(
        `
            *,
            job_postings:job_id (
                id,
                company,
                title,
                url,
                description,
                tech_tags,
                created_at
            )
        `,
    );

    if (filters?.profileId) {
        query = query.eq("profile_id", filters.profileId);
    }

    if (filters?.jobId) {
        query = query.eq("job_id", filters.jobId);
    }

    if (filters?.status) {
        query = query.eq("status", filters.status);
    }

    const { data, error } = await query.order("created_at", {
        ascending: false,
    });

    if (error) throw error;
    return data;
}

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
            `Failed to update match scores: ${errors
                .map((e) => e!.message)
                .join(", ")}`,
        );
    }

    return results;
}

export async function deleteApplication(applicationId: string) {
    const { error } = await supabase
        .from("applications")
        .delete()
        .eq("id", applicationId);

    if (error) throw error;
}
