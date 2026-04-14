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

interface JobStats {
    totalJobs: number;
    jobsByTerm: Record<string, number>;
    newJobsThisWeek: number;
    calgaryJobs: number;
    timestamp: Date;
}

type ApplicationStatus =
    | "saved"
    | "applied"
    | "interview"
    | "offer"
    | "rejected";

interface ProfileApplicationStats {
    applicationsThisWeek: number;
    applicationsByStatusThisWeek: Record<ApplicationStatus, number>;
}

interface ProfileSummaryRecipient {
    id: string;
    name: string | null;
    email: string | null;
    discord_webhook_url: string | null;
}

interface DeltaMetrics {
    totalJobsDelta: number | null;
    totalJobsPercentChange: number | null;
    newJobsDelta: number | null;
    calgaryJobsDelta: number | null;
    calgaryJobsPercentChange: number | null;
    hasLastWeekData: boolean;
}

interface ProfileApplicationDeltas {
    applicationsThisWeekDelta: number | null;
    applicationsThisWeekPercentChange: number | null;
    statusDelta: Record<ApplicationStatus, number | null>;
    statusPercentChange: Record<ApplicationStatus, number | null>;
    hasLastWeekData: boolean;
}

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

interface DeliveryResult {
    profileId: string;
    profileName: string;
    channel: "discord" | "email" | "none";
    success: boolean;
    error?: string;
}

function isCalgaryJob(location: string | null | undefined): boolean {
    return Boolean(location?.toLowerCase().includes("calgary"));
}

function getEmptyStatusCounts(): Record<ApplicationStatus, number> {
    return {
        saved: 0,
        applied: 0,
        interview: 0,
        offer: 0,
        rejected: 0,
    };
}

function isValidApplicationStatus(status: string): status is ApplicationStatus {
    return (
        status === "saved" ||
        status === "applied" ||
        status === "interview" ||
        status === "offer" ||
        status === "rejected"
    );
}

async function fetchCurrentStats(supabase: any): Promise<JobStats> {
    const { data: allJobs, error: allJobsError } = (await supabase
        .from("job_postings")
        .select("location, created_at")) as {
        data: Array<{ location: string | null; created_at: string }> | null;
        error: any;
    };

    if (allJobsError) {
        throw new Error(`Failed to fetch all jobs: ${allJobsError.message}`);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const totalJobs = allJobs?.length ?? 0;
    const newJobsThisWeek =
        allJobs?.filter((job) => new Date(job.created_at) >= sevenDaysAgo)
            .length ?? 0;
    const calgaryJobs =
        allJobs?.filter((job) => isCalgaryJob(job.location)).length ?? 0;

    return {
        totalJobs,
        jobsByTerm: {},
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

async function saveCurrentStats(supabase: any, stats: JobStats): Promise<void> {
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
    }
}

async function fetchRecipients(supabase: any): Promise<ProfileSummaryRecipient[]> {
    const { data, error } = (await supabase
        .from("profiles")
        .select("id, name, email, discord_webhook_url")) as {
        data: ProfileSummaryRecipient[] | null;
        error: any;
    };

    if (error) {
        throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    return (data || []).filter((profile) => {
        const webhook = (profile.discord_webhook_url || "").trim();
        const email = (profile.email || "").trim();
        return webhook.length > 0 || email.length > 0;
    });
}

async function fetchProfileApplicationStats(
    supabase: any,
    profileId: string,
): Promise<{
    current: ProfileApplicationStats;
    previous: ProfileApplicationStats;
}> {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: currentWeekApplications, error: currentWeekError } =
        (await supabase
            .from("applications")
            .select("status")
            .eq("profile_id", profileId)
            .gte("created_at", sevenDaysAgo.toISOString())) as {
            data: Array<{ status: string }> | null;
            error: any;
        };

    if (currentWeekError) {
        throw new Error(
            `Failed to fetch current week applications: ${currentWeekError.message}`,
        );
    }

    const { data: previousWeekApplications, error: previousWeekError } =
        (await supabase
            .from("applications")
            .select("status")
            .eq("profile_id", profileId)
            .gte("created_at", fourteenDaysAgo.toISOString())
            .lt("created_at", sevenDaysAgo.toISOString())) as {
            data: Array<{ status: string }> | null;
            error: any;
        };

    if (previousWeekError) {
        throw new Error(
            `Failed to fetch previous week applications: ${previousWeekError.message}`,
        );
    }

    const currentByStatus = getEmptyStatusCounts();
    (currentWeekApplications ?? []).forEach((application) => {
        if (isValidApplicationStatus(application.status)) {
            currentByStatus[application.status] += 1;
        }
    });

    const previousByStatus = getEmptyStatusCounts();
    (previousWeekApplications ?? []).forEach((application) => {
        if (isValidApplicationStatus(application.status)) {
            previousByStatus[application.status] += 1;
        }
    });

    return {
        current: {
            applicationsThisWeek: currentWeekApplications?.length ?? 0,
            applicationsByStatusThisWeek: currentByStatus,
        },
        previous: {
            applicationsThisWeek: previousWeekApplications?.length ?? 0,
            applicationsByStatusThisWeek: previousByStatus,
        },
    };
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
            ? Number(((totalJobsDelta / lastWeekStats.totalJobs) * 100).toFixed(1))
            : null;

    const newJobsDelta =
        currentStats.newJobsThisWeek - lastWeekStats.newJobsThisWeek;

    const calgaryJobsDelta = currentStats.calgaryJobs - lastWeekStats.calgaryJobs;
    const calgaryJobsPercentChange =
        lastWeekStats.calgaryJobs > 0
            ? Number(((calgaryJobsDelta / lastWeekStats.calgaryJobs) * 100).toFixed(1))
            : null;

    return {
        totalJobsDelta,
        totalJobsPercentChange,
        newJobsDelta,
        calgaryJobsDelta,
        calgaryJobsPercentChange,
        hasLastWeekData: true,
    };
}

function calculateProfileApplicationDeltas(
    current: ProfileApplicationStats,
    previous: ProfileApplicationStats,
): ProfileApplicationDeltas {
    const hasPreviousWeekData = previous.applicationsThisWeek > 0;

    const statusDelta: Record<ApplicationStatus, number | null> = {
        saved: null,
        applied: null,
        interview: null,
        offer: null,
        rejected: null,
    };

    const statusPercentChange: Record<ApplicationStatus, number | null> = {
        saved: null,
        applied: null,
        interview: null,
        offer: null,
        rejected: null,
    };

    const statuses: ApplicationStatus[] = [
        "saved",
        "applied",
        "interview",
        "offer",
        "rejected",
    ];

    statuses.forEach((status) => {
        const delta =
            current.applicationsByStatusThisWeek[status] -
            previous.applicationsByStatusThisWeek[status];
        statusDelta[status] = hasPreviousWeekData ? delta : null;

        if (hasPreviousWeekData && previous.applicationsByStatusThisWeek[status] > 0) {
            statusPercentChange[status] = Number(
                (
                    (delta / previous.applicationsByStatusThisWeek[status]) *
                    100
                ).toFixed(1),
            );
        }
    });

    const applicationsThisWeekDelta =
        current.applicationsThisWeek - previous.applicationsThisWeek;

    const applicationsThisWeekPercentChange =
        hasPreviousWeekData && previous.applicationsThisWeek > 0
            ? Number(
                  (
                      (applicationsThisWeekDelta /
                          previous.applicationsThisWeek) *
                      100
                  ).toFixed(1),
              )
            : null;

    return {
        applicationsThisWeekDelta: hasPreviousWeekData
            ? applicationsThisWeekDelta
            : null,
        applicationsThisWeekPercentChange,
        statusDelta,
        statusPercentChange,
        hasLastWeekData: hasPreviousWeekData,
    };
}

function buildDiscordEmbed(
    stats: JobStats,
    deltas: DeltaMetrics,
    profileName: string,
    applicationStats: ProfileApplicationStats,
    applicationDeltas: ProfileApplicationDeltas,
): DiscordEmbed {
    const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://internshipradar.ca";

    let description = `📊 **Weekly Internship Summary** 📊\n\n`;
    description += `🍁 Check out the latest Canadian tech internships on **Internship Radar**!\n\n`;
    description += `🙌 Personalized for **${profileName}** with your weekly application progress.\n\n`;

    const totalJobsValue = `**${stats.totalJobs}** open positions${
        deltas.hasLastWeekData && deltas.totalJobsDelta !== null
            ? ` ${deltas.totalJobsDelta >= 0 ? "📈" : "📉"} ${deltas.totalJobsDelta > 0 ? "+" : ""}${deltas.totalJobsDelta}${deltas.totalJobsPercentChange !== null ? ` (${deltas.totalJobsPercentChange}%)` : ""}`
            : ""
    }`;

    const newJobsValue = `**${stats.newJobsThisWeek}** new jobs this week${
        deltas.hasLastWeekData && deltas.newJobsDelta !== null
            ? ` ${deltas.newJobsDelta >= 0 ? "🎉" : "📉"} ${deltas.newJobsDelta > 0 ? "+" : ""}${deltas.newJobsDelta}`
            : ""
    }`;

    const calgaryJobsValue = `🏙️ **${stats.calgaryJobs}** positions in Calgary${
        deltas.hasLastWeekData && deltas.calgaryJobsDelta !== null
            ? ` ${deltas.calgaryJobsDelta >= 0 ? "📈" : "📉"} ${deltas.calgaryJobsDelta > 0 ? "+" : ""}${deltas.calgaryJobsDelta}${deltas.calgaryJobsPercentChange !== null ? ` (${deltas.calgaryJobsPercentChange}%)` : ""}`
            : ""
    }`;

    const applicationsThisWeekValue = `**${applicationStats.applicationsThisWeek}** applications this week${
        applicationDeltas.hasLastWeekData &&
        applicationDeltas.applicationsThisWeekDelta !== null
            ? ` ${applicationDeltas.applicationsThisWeekDelta >= 0 ? "📈" : "📉"} ${applicationDeltas.applicationsThisWeekDelta > 0 ? "+" : ""}${applicationDeltas.applicationsThisWeekDelta}${applicationDeltas.applicationsThisWeekPercentChange !== null ? ` (${applicationDeltas.applicationsThisWeekPercentChange}%)` : ""}`
            : ""
    }`;

    const applicationStatusLabels: Record<ApplicationStatus, string> = {
        saved: "Saved",
        applied: "Applied",
        interview: "Interview",
        offer: "Offer",
        rejected: "Rejected",
    };

    const applicationStatusBreakdown = (
        ["saved", "applied", "interview", "offer", "rejected"] as ApplicationStatus[]
    )
        .map((status) => {
            const currentValue = applicationStats.applicationsByStatusThisWeek[status];
            const delta = applicationDeltas.statusDelta[status];
            const percent = applicationDeltas.statusPercentChange[status];

            if (!applicationDeltas.hasLastWeekData || delta === null) {
                return `• ${applicationStatusLabels[status]}: **${currentValue}**`;
            }

            const sign = delta > 0 ? "+" : "";
            const trendEmoji = delta >= 0 ? "📈" : "📉";
            const percentText = percent !== null ? ` (${percent}%)` : "";

            return `• ${applicationStatusLabels[status]}: **${currentValue}** ${trendEmoji} ${sign}${delta}${percentText}`;
        })
        .join("\n");

    const fields: Array<{ name: string; value: string; inline: boolean }> = [
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
        {
            name: "🧭 Your Application Activity",
            value: applicationsThisWeekValue,
            inline: false,
        },
        {
            name: "📌 Your Weekly Status Breakdown",
            value: applicationStatusBreakdown,
            inline: false,
        },
        {
            name: "🔗 Ready to Apply?",
            value: `[Browse on Internship Radar](${baseUrl})`,
            inline: false,
        },
    ];

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

async function sendToDiscordWebhook(
    webhookUrl: string,
    embed: DiscordEmbed,
): Promise<void> {
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Discord webhook failed with status ${response.status}: ${errorText}`,
        );
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildSummaryEmailHtml(embed: DiscordEmbed): string {
    const fieldsHtml = embed.fields
        .map(
            (field) => `
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: 700; margin-bottom: 4px;">${escapeHtml(field.name)}</div>
                    <div>${escapeHtml(field.value).replace(/\n/g, "<br />")}</div>
                </div>
            `,
        )
        .join("\n");

    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 680px; margin: 0 auto;">
            <h2 style="margin-bottom: 8px;">${escapeHtml(embed.title)}</h2>
            <p style="margin-top: 0; white-space: pre-line;">${escapeHtml(embed.description)}</p>
            <hr style="border: 0; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
            ${fieldsHtml}
            <hr style="border: 0; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px; margin: 0;">${escapeHtml(embed.footer.text)}</p>
        </div>
    `;
}

function buildSummaryEmailText(embed: DiscordEmbed): string {
    const fieldsText = embed.fields
        .map((field) => `${field.name}\n${field.value}`)
        .join("\n\n");

    return `${embed.title}\n\n${embed.description}\n\n${fieldsText}\n\n${embed.footer.text}`;
}

async function sendSummaryEmail(
    toEmail: string,
    embed: DiscordEmbed,
): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.SUMMARY_EMAIL_FROM;

    if (!resendApiKey) {
        throw new Error("RESEND_API_KEY is not configured");
    }

    if (!fromEmail) {
        throw new Error("SUMMARY_EMAIL_FROM is not configured");
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: fromEmail,
            to: [toEmail],
            subject: "Internship Radar Weekly Summary",
            html: buildSummaryEmailHtml(embed),
            text: buildSummaryEmailText(embed),
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Email send failed with status ${response.status}: ${errorText}`,
        );
    }
}

async function deliverSummary(
    recipient: ProfileSummaryRecipient,
    embed: DiscordEmbed,
): Promise<{ channel: "discord" | "email" }> {
    const webhook = (recipient.discord_webhook_url || "").trim();
    const email = (recipient.email || "").trim();

    if (webhook) {
        await sendToDiscordWebhook(webhook, embed);
        return { channel: "discord" };
    }

    if (email) {
        await sendSummaryEmail(email, embed);
        return { channel: "email" };
    }

    throw new Error("Profile has neither webhook nor email");
}

export async function GET(request: NextRequest) {
    try {
        if (!verifyCronSecret(request)) {
            return NextResponse.json(
                { error: "Unauthorized: Invalid CRON_SECRET" },
                { status: 401 },
            );
        }

        const supabase = getSupabaseClient();

        const currentStats = await fetchCurrentStats(supabase);
        const lastWeekStats = await getLastWeekStats(supabase);
        const deltas = calculateDeltas(currentStats, lastWeekStats);

        const recipients = await fetchRecipients(supabase);
        const deliveryResults: DeliveryResult[] = [];

        for (const recipient of recipients) {
            try {
                const {
                    current: currentApplicationStats,
                    previous: previousApplicationStats,
                } = await fetchProfileApplicationStats(supabase, recipient.id);

                const applicationDeltas = calculateProfileApplicationDeltas(
                    currentApplicationStats,
                    previousApplicationStats,
                );

                const embed = buildDiscordEmbed(
                    currentStats,
                    deltas,
                    recipient.name || recipient.email || "Internship Radar User",
                    currentApplicationStats,
                    applicationDeltas,
                );

                const delivery = await deliverSummary(recipient, embed);

                deliveryResults.push({
                    profileId: recipient.id,
                    profileName: recipient.name || recipient.email || recipient.id,
                    channel: delivery.channel,
                    success: true,
                });
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                deliveryResults.push({
                    profileId: recipient.id,
                    profileName: recipient.name || recipient.email || recipient.id,
                    channel: "none",
                    success: false,
                    error: errorMessage,
                });
            }
        }

        await saveCurrentStats(supabase, currentStats);

        const successful = deliveryResults.filter((result) => result.success);
        const failed = deliveryResults.filter((result) => !result.success);
        const discordCount = successful.filter(
            (result) => result.channel === "discord",
        ).length;
        const emailCount = successful.filter(
            (result) => result.channel === "email",
        ).length;

        return NextResponse.json(
            {
                success: true,
                message: `Weekly summary sent. Discord: ${discordCount}, Email: ${emailCount}, Failed: ${failed.length}`,
                stats: currentStats,
                deltas,
                recipients: {
                    total: recipients.length,
                    successful: successful.length,
                    failed: failed.length,
                    discord: discordCount,
                    email: emailCount,
                    results: deliveryResults,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
            },
            { status: 500 },
        );
    }
}
