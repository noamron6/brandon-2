import { NextRequest, NextResponse } from "next/server";
import { getSummaryRaw, updateSummaryPaid } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, session_id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing summary id" }, { status: 400 });
    }

    const summary = getSummaryRaw(id);
    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    // Update paid state
    updateSummaryPaid(id, session_id || summary.stripe_session_id || "simulated_session");

    return NextResponse.json({
      success: true,
      token: summary.access_token,
      message: "סימולציית תשלום הושלמה בהצלחה (סביבת פיתוח)",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
