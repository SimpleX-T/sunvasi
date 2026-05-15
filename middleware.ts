import type { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

export function middleware(request: NextRequest) {
  return createClient(request);
}

export const config = {
  matcher: [
    /*
     * Match every request path except:
     *   - _next/static (static files)
     *   - _next/image  (image optimisation)
     *   - favicon.ico, robots.txt, sitemap.xml
     *   - public file extensions (svg, png, jpg, jpeg, gif, webp, ico, woff2)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)",
  ],
};
