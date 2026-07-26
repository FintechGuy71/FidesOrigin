import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy rules save requests to the backend API.
 * The API key is stored server-side and never exposed to the client.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rules } = body;

    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { error: "Rules array is required" },
        { status: 400 }
      );
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const rulesApiUrl = process.env.NEXT_PUBLIC_RULES_API_URL ||
      (apiBase ? `${apiBase}/rules` : undefined);

    if (!rulesApiUrl) {
      return NextResponse.json(
        { error: "Rules API not configured" },
        { status: 503 }
      );
    }

    const apiKey = process.env.API_KEY;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    const response = await fetch(`${rulesApiUrl}/save`, {
      method: "POST",
      headers,
      body: JSON.stringify({ rules }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Rules save proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
