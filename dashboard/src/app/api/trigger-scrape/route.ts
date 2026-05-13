import { NextRequest, NextResponse } from "next/server";

const REPO = "monish-pixel/kytchens-restaurant-monitor";
const WORKFLOW = "scrape.yml";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.GH_WORKFLOW_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "GH_WORKFLOW_TOKEN not configured" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error("[trigger-scrape] GH dispatch failed:", res.status, body);
    return NextResponse.json({ error: "GH dispatch failed", status: res.status }, { status: 502 });
  }

  console.log("[trigger-scrape] Workflow dispatched at", new Date().toISOString());
  return NextResponse.json({ triggered: true, at: new Date().toISOString() });
}
