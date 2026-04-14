import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================================
// SECURITY: Verify the cron secret to prevent unauthorized access
// ============================================================================
function verifyCronSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.error("CRON_SECRET environment variable not configured");
        return false;
    }

    return authHeader === `Bearer ${cronSecret}`;
}

// ============================================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================================
type SupabaseClient = any;

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
// DATA FETCHING LOGIC
// ============================================================================
interface JobStats {
    totalJobs: number;
    jobsByTerm: Record<string, number>;
    newJobsThisWeek: number;
    calgaryJobs: number;
    timestamp: Date;
}

interface JobPostingSummaryRow {
    term?: string | null;
    location?: string | null;
}

function isCalgaryJob(location: string | null | undefined): boolean {
    return Boolean(location?.toLowerCase().includes("calgary"));
}

async function fetchCurrentStats(
    supabase: SupabaseClient,
): Promise<JobStats> {
    // Fetch all active jobs
    const { data: allJobs, error: allJobsError } = await supabase
        .from("job_postings")
        .select("term, location")
        .eq("is_active", true);

    if (allJobsError) {
        throw new Error(`Failed to fetch all jobs: ${allJobsError.message}`);
    }

    // Fetch jobs added in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: newJobs, error: newJobsError } = await supabase
        .from("job_postings")
        .select("id")
        .eq("is_active", true)
        .gte("created_at", sevenDaysAgo.toISOString());

    if (newJobsError) {
        throw new Error(`Failed to fetch new jobs: ${newJobsError.message}`);
    }

    // Process the data
    const totalJobs = allJobs?.length ?? 0;
    const newJobsThisWeek = newJobs?.length ?? 0;
    const calgaryJobs =
        allJobs?.filter((job: JobPostingSummaryRow) => isCalgaryJob(job.location))
            .length ?? 0;

    // Group jobs by term
    const jobsByTerm: Record<string, number> = {};
    allJobs?.forEach((job: JobPostingSummaryRow) => {
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

// ============================================================================
// STATS PERSISTENCE: Store and retrieve weekly snapshots
// ============================================================================
async function getLastWeekStats(
    supabase: SupabaseClient,
): Promise<JobStats | null> {
    const { data, error } = await supabase
        .from("internship_radar_stats")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.warn(`Could not retrieve last week's stats: ${error.message}`);
        return null;
    }

    if (!data || data.length === 0) {
        console.warn("No previous stats found - this may be the first run");
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

async function saveCurrentStats(
    supabase: SupabaseClient,
    stats: JobStats,
): Promise<void> {
    const { error } = await supabase.from("internship_radar_stats").insert([
        {
            total_jobs: stats.totalJobs,
            jobs_by_term: stats.jobsByTerm,
            new_jobs_this_week: stats.newJobsThisWeek,
            alberta_jobs: stats.calgaryJobs,
            created_at: new Date().toISOString(),
        },
    ]);

    if (error) {
        console.error(`Failed to save stats: ${error.message}`);
        // Don't throw - this shouldn't stop the Discord message from being sent
    }
}

// ============================================================================
// DELTA CALCULATION WITH FALLBACK
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
        // Fallback: No previous data, so no deltas to calculate
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

    // Format the main stats section
    let description = `📊 **Weekly Internship Summary** 📊\n\n`;
    description += `🍁 Check out the latest Canadian tech internships on **Internship Radar**!\n\n`;

    // Build field values with deltas
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

    // Add breakdown by term if available
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

    // Add a call-to-action field
    fields.push({
        name: "🔗 Ready to Apply?",
        value: `[Browse on Internship Radar](${baseUrl})`,
        inline: false,
    });

    return {
        title: "Weekly Internship Summary 📋",
        description,
        color: 0x1f9fff, // A nice teal blue
        fields,
        footer: {
            text: "Internship Radar • Tracking Canadian Tech Internships",
            icon_url: "🍁",
        },
        timestamp: new Date().toISOString(),
    };
}

// ============================================================================
// FETCH PROFILES WITH DISCORD WEBHOOKS
// ============================================================================
interface ProfileWithWebhook {
    id: string;
    name: string | null;
    discord_webhook_url: string;
}

async function fetchProfilesWithWebhooks(
    supabase: SupabaseClient,
): Promise<ProfileWithWebhook[]> {
    const { data, error } = await supabase
        .from("profiles")
        .select("id, name, discord_webhook_url")
        .not("discord_webhook_url", "is", null)
        .neq("discord_webhook_url", ""); // Exclude empty strings

    if (error) {
        throw new Error(
            `Failed to fetch profiles with webhooks: ${error.message}`,
        );
    }

    return (data as ProfileWithWebhook[]) || [];
}

// ============================================================================
// DISCORD WEBHOOK SENDER (Per-User & Global)
// ============================================================================
interface WebhookSendResult {
    webhookUrl: string;
    profileId?: string;
    profileName?: string;
    success: boolean;
    error?: string;
}

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

async function sendToAllUserWebhooks(
    profiles: ProfileWithWebhook[],
    embed: DiscordEmbed,
): Promise<WebhookSendResult[]> {
    const results: WebhookSendResult[] = [];

    for (const profile of profiles) {
        try {
            await sendToDiscordWebhook(profile.discord_webhook_url, embed);
            results.push({
                webhookUrl: profile.discord_webhook_url,
                profileId: profile.id,
                profileName: profile.name ?? "Unknown",
                success: true,
            });
            console.log(
                `✅ Sent summary to ${profile.name || profile.id}: ${profile.discord_webhook_url.slice(0, 50)}...`,
            );
        } catch (error) {
            const errorMsg =
                error instanceof Error ? error.message : String(error);
            results.push({
                webhookUrl: profile.discord_webhook_url,
                profileId: profile.id,
                profileName: profile.name ?? "Unknown",
                success: false,
                error: errorMsg,
            });
            console.error(
                `❌ Failed to send to ${profile.name || profile.id}: ${errorMsg}`,
            );
        }
    }

    return results;
}

async function sendToGlobalWebhook(
    embed: DiscordEmbed,
): Promise<WebhookSendResult | null> {
    const globalWebhook = process.env.DISCORD_WEBHOOK_URL;

    if (!globalWebhook) {
        console.log("ℹ️ No global DISCORD_WEBHOOK_URL configured (optional)");
        return null;
    }

    try {
        await sendToDiscordWebhook(globalWebhook, embed);
        console.log("✅ Sent summary to global Discord webhook");
        return {
            webhookUrl: globalWebhook,
            success: true,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to send to global webhook: ${errorMsg}`);
        return {
            webhookUrl: globalWebhook,
            success: false,
            error: errorMsg,
        };
    }
}

// ============================================================================
// MAIN ENDPOINT HANDLER
// ============================================================================
export async function GET(request: NextRequest) {
    try {
        // Step 1: Verify security
        if (!verifyCronSecret(request)) {
            return NextResponse.json(
                { error: "Unauthorized: Invalid CRON_SECRET" },
                { status: 401 },
            );
        }

        // Step 2: Initialize Supabase client
        const supabase = getSupabaseClient();

        // Step 3: Fetch current stats
        const currentStats = await fetchCurrentStats(supabase);
        console.log("📊 Current stats fetched:", currentStats);

        // Step 4: Fetch last week's stats (for delta calculation)
        const lastWeekStats = await getLastWeekStats(supabase);
        console.log(
            "📈 Last week stats retrieved:",
            lastWeekStats ? "Found" : "None (first run)",
        );

        // Step 5: Calculate deltas (with fallback if no last week data)
        const deltas = calculateDeltas(currentStats, lastWeekStats);
        console.log("🔢 Deltas calculated:", deltas);

        // Step 6: Build Discord embed
        const embed = buildDiscordEmbed(currentStats, deltas);

        // Step 7a: Fetch all profiles with Discord webhooks
        const profilesWithWebhooks = await fetchProfilesWithWebhooks(supabase);
        console.log(
            `👥 Found ${profilesWithWebhooks.length} profiles with Discord webhooks`,
        );

        // Step 7b: Send to all user webhooks
        const userResults = await sendToAllUserWebhooks(
            profilesWithWebhooks,
            embed,
        );

        // Step 7c: Send to global webhook (optional)
        const globalResult = await sendToGlobalWebhook(embed);

        // Step 8: Save current stats for next week's comparison
        await saveCurrentStats(supabase, currentStats);
        console.log("💾 Current stats saved for next week");

        // Compile results summary
        const successCount = userResults.filter((r) => r.success).length;
        const failureCount = userResults.filter((r) => !r.success).length;

        return NextResponse.json(
            {
                success: true,
                message: `Discord summary sent successfully to ${successCount}/${userResults.length} user webhooks${globalResult ? (globalResult.success ? " and global webhook" : " (global webhook failed)") : ""}`,
                stats: currentStats,
                deltas,
                webhooksSent: {
                    users: {
                        total: userResults.length,
                        successful: successCount,
                        failed: failureCount,
                        results: userResults,
                    },
                    global: globalResult,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : String(error);
        console.error("❌ Discord summary endpoint error:", errorMessage);

        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
            },
            { status: 500 },
        );
    }
}
