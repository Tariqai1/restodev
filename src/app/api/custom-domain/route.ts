import { NextRequest, NextResponse } from "next/server";
import dns from "dns/promises";

// In-memory / persistent mock map for restaurant custom domains
const domainRegistry: Record<string, { domain: string; verified: boolean; configuredAt: string }> = {};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") || "default";
  const entry = domainRegistry[restaurantId];

  return NextResponse.json({
    customDomain: entry?.domain || null,
    verified: entry?.verified || false,
    dnsInstructions: {
      type: "CNAME",
      host: entry?.domain ? entry.domain.split(".")[0] : "menu",
      target: "cname.orderdesk.io",
      ttl: 300,
    },
    status: entry ? (entry.verified ? "active" : "pending_verification") : "unconfigured",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId = "default", domain } = body;

    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ error: "Domain name is required" }, { status: 400 });
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    
    // DNS CNAME check
    let verified = false;
    try {
      const records = await dns.resolveCname(cleanDomain);
      if (records && records.some((r) => r.includes("orderdesk.io") || r.includes("vercel"))) {
        verified = true;
      }
    } catch {
      // DNS not propagated yet; allow configuration in pending state
      verified = false;
    }

    domainRegistry[restaurantId] = {
      domain: cleanDomain,
      verified,
      configuredAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      customDomain: cleanDomain,
      verified,
      message: verified
        ? "Domain verified and active!"
        : "Domain registered. Point your CNAME record to cname.orderdesk.io to complete SSL verification.",
      dnsInstructions: {
        type: "CNAME",
        name: cleanDomain,
        target: "cname.orderdesk.io",
        ttl: 300,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Domain setup failed" }, { status: 500 });
  }
}

