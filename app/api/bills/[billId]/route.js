import { NextResponse } from "next/server";
import { getBillById } from "@/lib/bills";

export const revalidate = 3600;

export async function GET(_request, { params }) {
  const bill = await getBillById(params.billId);

  if (!bill) {
    return NextResponse.json(
      {
        error: `Bill with id "${params.billId}" not found`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: bill });
}
