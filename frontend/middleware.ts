import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const protectedPaths = ["/tracker", "/profile"];

export async function middleware(request: NextRequest) {
    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    if (!supabaseUrl || !supabaseKey) {
        return response;
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options);
                });
            },
        },
    });

    const {
        data: { session },
    } = await supabase.auth.getSession();

    const isProtected = protectedPaths.some((path) =>
        request.nextUrl.pathname.startsWith(path),
    );
    const isLoginPage = request.nextUrl.pathname === "/login";

    if (!session && isProtected) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/login";
        const redirectTarget = `${request.nextUrl.pathname}${request.nextUrl.search}`;
        redirectUrl.search = "";
        redirectUrl.searchParams.set("redirect", redirectTarget);
        return NextResponse.redirect(redirectUrl);
    }

    if (session && isLoginPage) {
        const redirectParam = request.nextUrl.searchParams.get("redirect");
        const destination =
            redirectParam && redirectParam.startsWith("/")
                ? redirectParam
                : "/profile";

        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = destination;
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
    }

    return response;
}

export const config = {
    matcher: ["/tracker/:path*", "/profile/:path*", "/login"],
};
