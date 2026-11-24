import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

/** Rough placeholder: assume ~₹0.08 API cost per ₹1 revenue until metering lands. */
const API_COST_RATIO = 0.08;

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { service } = auth.ctx;

  const [
    signupsRes,
    trialRes,
    subsRes,
    revenueRes,
  ] = await Promise.all([
    service.from("profiles").select("id", { count: "exact", head: true }),
    service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("trial_started_at", "is", null),
    service
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    service
      .from("payments")
      .select("amount_paise")
      .eq("status", "paid"),
  ]);

  const revenuePaise =
    revenueRes.data?.reduce((sum, row) => sum + (row.amount_paise ?? 0), 0) ?? 0;
  const apiCostEstimatePaise = Math.round(revenuePaise * API_COST_RATIO);

  return NextResponse.json({
    signups: signupsRes.count ?? 0,
    trialStarted: trialRes.count ?? 0,
    activeSubs: subsRes.count ?? 0,
    revenuePaise,
    apiCostEstimatePaise,
    revenueInr: revenuePaise / 100,
    apiCostEstimateInr: apiCostEstimatePaise / 100,
  });
}
