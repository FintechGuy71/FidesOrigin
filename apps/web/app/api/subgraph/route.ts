import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy Subgraph queries to protect the Subgraph URL from client exposure.
 * This also enables rate limiting and request validation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, variables } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const subgraphUrl = process.env.NEXT_PUBLIC_SUBGRAPH_URL;

    if (!subgraphUrl) {
      return NextResponse.json(
        { error: "Subgraph not configured" },
        { status: 503 }
      );
    }

    const response = await fetch(subgraphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Subgraph proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
