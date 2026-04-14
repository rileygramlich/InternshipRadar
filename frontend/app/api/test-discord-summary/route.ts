import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// ============================================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================================
function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase configuration");
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// ============================================================================
// GET CURRENT USER FROM SESSION COOKIES
// ============================================================================
async function getCurrentUser(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase configuration");
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll() {
                // No-op for reading session
            },
        },
    });

    const {
        data: { session },
    } = await supabase.auth.getSession();

    return session?.user ?? null;
}

// ============================================================================
// DATA FETCHING LOGIC (Copied from discord-summary/route.ts)
// ============================================================================
interface JobStats {
    totalJobs: number;
    jobsByTerm: Record<string, number>;
    newJobsThisWeek: number;
    calgaryJobs: number;
    timestamp: Date;
}

function isCalgaryJob(location: string | null | undefined): boolean {
    return Boolean(location?.toLowerCase().includes("calgary"));
}

async function fetchCurrentStats(supabase: any): Promise<JobStats> {
    const { data: allJobs, error: allJobsError } = (await supabase
        .from("job_postings")
        .select("term, location")
        .eq("is_active", true)) as {
        data: Array<{ term: string; location: string | null }> | null;
        error: any;
    };

    if (allJobsError) {
        throw new Error(`Failed to fetch all jobs: ${allJobsError.message}`);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: newJobs, error: newJobsError } = (await supabase
        .from("job_postings")
        .select("id")
        .eq("is_active", true)
        .gte("created_at", sevenDaysAgo.toISOString())) as {
        data: Array<{ id: string }> | null;
        error: any;
    };

    if (newJobsError) {
        throw new Error(`Failed to fetch new jobs: ${newJobsError.message}`);
    }

    const totalJobs = allJobs?.length ?? 0;
    const newJobsThisWeek = newJobs?.length ?? 0;
    const calgaryJobs =
        allJobs?.filter((job) => isCalgaryJob(job.location)).length ?? 0;

    const jobsByTerm: Record<string, number> = {};
    allJobs?.forEach((job) => {
        const term = job.term || "Unknown";
        jobsByTerm[term] = (jobsByTerm[term] ?? 0) + 1;
    });

    return {
        totalJobs,
        jobsByTerm,
        newJobsThisWeek,
        calgaryJobs,
        timestamp: new Date(),
    };
}

async function getLastWeekStats(supabase: any): Promise<JobStats | null> {
    const { data, error } = (await supabase
        .from("internship_radar_stats")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)) as {
        data: Array<{
            total_jobs: number;
            jobs_by_term: Record<string, number>;
            new_jobs_this_week: number;
            alberta_jobs: number;
            created_at: string;
        }> | null;
        error: any;
    };

    if (error) {
        console.warn(`Could not retrieve last week's stats: ${error.message}`);
        return null;
    }

    if (!data || data.length === 0) {
        return null;
    }

    const record = data[0];
    return {
        totalJobs: record.total_jobs,
        jobsByTerm: record.jobs_by_term || {},
        newJobsThisWeek: record.new_jobs_this_week,
        calgaryJobs: record.alberta_jobs,
        timestamp: new Date(record.created_at),
    };
}

// ============================================================================
// DELTA CALCULATION
// ============================================================================
interface DeltaMetrics {
    totalJobsDelta: number | null;
    totalJobsPercentChange: number | null;
    newJobsDelta: number | null;
    calgaryJobsDelta: number | null;
    calgaryJobsPercentChange: number | null;
    hasLastWeekData: boolean;
}

function calculateDeltas(
    currentStats: JobStats,
    lastWeekStats: JobStats | null,
): DeltaMetrics {
    if (!lastWeekStats) {
        return {
            totalJobsDelta: null,
            totalJobsPercentChange: null,
            newJobsDelta: null,
            calgaryJobsDelta: null,
            calgaryJobsPercentChange: null,
            hasLastWeekData: false,
        };
    }

    const totalJobsDelta = currentStats.totalJobs - lastWeekStats.totalJobs;
    const totalJobsPercentChange =
        lastWeekStats.totalJobs > 0
            ? ((totalJobsDelta / lastWeekStats.totalJobs) * 100).toFixed(1)
            : null;

    const newJobsDelta =
        currentStats.newJobsThisWeek - lastWeekStats.newJobsThisWeek;

    const calgaryJobsDelta =
        currentStats.calgaryJobs - lastWeekStats.calgaryJobs;
    const calgaryJobsPercentChange =
        lastWeekStats.calgaryJobs > 0
            ? ((calgaryJobsDelta / lastWeekStats.calgaryJobs) * 100).toFixed(1)
            : null;

    return {
        totalJobsDelta,
        totalJobsPercentChange: totalJobsPercentChange
            ? Number(totalJobsPercentChange)
            : null,
        newJobsDelta,
        calgaryJobsDelta,
        calgaryJobsPercentChange: calgaryJobsPercentChange
            ? Number(calgaryJobsPercentChange)
            : null,
        hasLastWeekData: true,
    };
}

// ============================================================================
// DISCORD EMBED FORMATTING
// ============================================================================
interface DiscordEmbed {
    title: string;
    description: string;
    color: number;
    fields: Array<{
        name: string;
        value: string;
        inline: boolean;
    }>;
    footer: {
        text: string;
        icon_url?: string;
    };
    timestamp: string;
}

function buildDiscordEmbed(
    stats: JobStats,
    deltas: DeltaMetrics,
): DiscordEmbed {
    const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://internshipradar.ca";

    let description = `📊 **Weekly Internship Summary** 📊\n\n`;
    description += `🍁 Check out the latest Canadian tech internships on **Internship Radar**!\n\n`;

    const totalJobsValue = `**${stats.totalJobs}** open positions${
        deltas.hasLastWeekData && deltas.totalJobsDelta !== null
            ? ` ${deltas.totalJobsDelta >= 0 ? "📈" : "📉"} ${deltas.totalJobsDelta > 0 ? "+" : ""}${deltas.totalJobsDelta} (${deltas.totalJobsPercentChange}%)`
            : ""
    }`;

    const newJobsValue = `**${stats.newJobsThisWeek}** new jobs this week${
        deltas.hasLastWeekData && deltas.newJobsDelta !== null
            ? ` ${deltas.newJobsDelta >= 0 ? "🎉" : "📉"} ${deltas.newJobsDelta > 0 ? "+" : ""}${deltas.newJobsDelta}`
            : ""
    }`;

    const calgaryJobsValue = `🏙️ **${stats.calgaryJobs}** positions in Calgary${
        deltas.hasLastWeekData && deltas.calgaryJobsDelta !== null
            ? ` ${deltas.calgaryJobsDelta >= 0 ? "📈" : "📉"} ${deltas.calgaryJobsDelta > 0 ? "+" : ""}${deltas.calgaryJobsDelta} (${deltas.calgaryJobsPercentChange}%)`
            : ""
    }`;

    const fields: Array<{
        name: string;
        value: string;
        inline: boolean;
    }> = [
        {
            name: "💼 Total Open Positions",
            value: totalJobsValue,
            inline: false,
        },
        {
            name: "✨ New This Week",
            value: newJobsValue,
            inline: false,
        },
        {
            name: "Calgary Focus",
            value: calgaryJobsValue,
            inline: false,
        },
    ];

    if (Object.keys(stats.jobsByTerm).length > 0) {
        const termBreakdown = Object.entries(stats.jobsByTerm)
            .map(([term, count]) => `• ${term}: **${count}**`)
            .join("\n");

        fields.push({
            name: "🗓️ Breakdown by Season",
            value: termBreakdown,
            inline: false,
        });
    }

    fields.push({
        name: "🔗 Ready to Apply?",
        value: `[Browse on Internship Radar](${baseUrl})`,
        inline: false,
    });

    return {
        title: "Weekly Internship Summary 📋",
        description,
        color: 3447003,
        fields,
        footer: {
            text: "Internship Radar 🎯",
        },
        timestamp: new Date().toISOString(),
    };
}

// ============================================================================
// SEND TO DISCORD
// ============================================================================
async function sendToDiscordWebhook(
    webhookUrl: string,
    embed: DiscordEmbed,
): Promise<void> {
    const payload = {
        embeds: [embed],
    };

    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Discord webhook failed with status ${response.status}: ${errorText}`,
        );
    }
}

// ============================================================================
// MAIN ENDPOINT HANDLER
// ============================================================================
export async function POST(request: NextRequest) {
    try {
        // Step 1: Get current user
        const user = await getCurrentUser(request);

        if (!user || !user.email) {
            return NextResponse.json(
                { error: "Unauthorized: User not authenticated" },
                { status: 401 },
            );
        }

        // Step 2: Initialize Supabase client
        const supabase = getSupabaseClient();

        // Step 3: Fetch user profile
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("discord_webhook_url, name")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { error: "Profile not found" },
                { status: 404 },
            );
        }

        if (!profile.discord_webhook_url) {
            return NextResponse.json(
                {
                    error: "No Discord webhook configured. Please add one in your profile settings.",
                },
                { status: 400 },
            );
        }

        // Step 4: Fetch current stats
        const currentStats = await fetchCurrentStats(supabase);
        console.log("📊 Current stats fetched:", currentStats);

        // Step 5: Fetch last week's stats
        const lastWeekStats = await getLastWeekStats(supabase);

        // Step 6: Calculate deltas
        const deltas = calculateDeltas(currentStats, lastWeekStats);

        // Step 7: Build Discord embed
        const embed = buildDiscordEmbed(currentStats, deltas);

        // Step 8: Send to user's webhook
        await sendToDiscordWebhook(profile.discord_webhook_url, embed);
        console.log(
            `✅ Test summary sent to ${profile.name || user.email}: ${profile.discord_webhook_url.slice(0, 50)}...`,
        );

        return NextResponse.json(
            {
                success: true,
                message: `Test summary sent successfully to your Discord!`,
                stats: currentStats,
            },
            { status: 200 },
        );
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : String(error);
        console.error("❌ Test Discord summary error:", errorMessage);

        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
            },
            { status: 500 },
        );
    }
}
