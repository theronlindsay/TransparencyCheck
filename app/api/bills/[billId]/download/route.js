import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { getBillById } from "@/lib/bills";
import { getBillTextAsset } from "@/lib/bill-text";

function acceptHeaderForMode(mode) {
  switch (mode) {
    case "html":
      return "text/html,application/xhtml+xml";
    case "xml":
      return "application/xml,text/xml";
    case "pdf":
      return "application/pdf";
    case "text":
    default:
      return "text/plain";
  }
}

function contentTypeForMode(mode, fallback) {
  if (fallback) return fallback;
  switch (mode) {
    case "html":
      return "text/html; charset=utf-8";
    case "xml":
      return "application/xml; charset=utf-8";
    case "pdf":
      return "application/pdf";
    case "text":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export async function GET(_request, { params }) {
  const { billId } = await params;

  if (!billId) {
    return NextResponse.json({ error: "Bill ID is required" }, { status: 400 });
  }

  const bill = await getBillById(billId);

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const asset = await getBillTextAsset(bill);

  if (!asset.available || !asset.url) {
    return NextResponse.json(
      { error: asset.reason ?? "Bill text unavailable." },
      { status: 404 }
    );
  }

  async function fetchDocument(url, mode) {
    return fetch(url, {
      headers: {
        Accept: acceptHeaderForMode(mode),
        "User-Agent": "TransparencyCheck/1.0 (+https://github.com/thero/transparency-check)",
      },
      cache: "no-store",
    });
  }

  let upstream;
  try {
    upstream = await fetchDocument(asset.url, asset.mode);

    if (!upstream.ok && asset.fallbackUrl && asset.fallbackUrl !== asset.url) {
      upstream = await fetchDocument(asset.fallbackUrl, asset.mode);
    }
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch source document: ${error.message}` },
      { status: 502 }
    );
  }

  if (!upstream || !upstream.ok) {
    if (asset.fallbackUrl?.startsWith("http")) {
      return NextResponse.redirect(asset.fallbackUrl, {
        status: 302,
      });
    }

    const status = upstream?.status ?? 502;
    return NextResponse.json(
      {
        error: `Congress.gov returned ${status} ${upstream?.statusText ?? ""}`.trim(),
      },
      { status: status === 404 ? 404 : 502 }
    );
  }

  const arrayBuffer = await upstream.arrayBuffer();
  const contentType = contentTypeForMode(
    asset.mode,
    upstream.headers.get("content-type")
  );
  const filename = asset.filename ?? "bill-text";

  return new NextResponse(Buffer.from(arrayBuffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
