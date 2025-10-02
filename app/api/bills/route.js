import { NextResponse } from "next/server";
import { getBills } from "@/lib/bills";

export const revalidate = 3600;

export async function GET() {
  const bills = await getBills();
  return NextResponse.json({ data: bills });
}
