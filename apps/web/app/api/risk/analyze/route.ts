import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy risk analysis requests to the backend API.
 * The API key is stored server-side and never exposed to the client.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const riskApiUrl = process.env.NEXT_PUBLIC_RISK_API_URL ||
      (apiBase ? `${apiBase}/risk` : undefined);

    if (!riskApiUrl) {
      return NextResponse.json(
        { error: "Risk API not configured" },
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

    const response = await fetch(`${riskApiUrl}/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({ address }),
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
    console.error("Risk analyze proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
