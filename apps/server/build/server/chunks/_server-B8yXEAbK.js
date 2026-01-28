import { j as json } from './index-CoD1IJuy.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}
const PDF_CACHE_DIR = path.join(process.cwd(), ".cache", "pdfs");
async function ensureCacheDir() {
  try {
    await fs.mkdir(PDF_CACHE_DIR, { recursive: true });
  } catch (err) {
    console.error("Error creating cache directory:", err);
  }
}
function generateFileName(url) {
  const hash = crypto.createHash("sha256").update(url).digest("hex");
  const billMatch = url.match(/\/bills\/(\w+)\/BILLS-/);
  const billId = billMatch ? billMatch[1] : "unknown";
  return `${billId}_${hash.substring(0, 16)}.pdf`;
}
async function GET({ url }) {
  const pdfUrl = url.searchParams.get("url");
  if (!pdfUrl) {
    return json({ error: "URL parameter is required" }, { status: 400, headers: corsHeaders });
  }
  console.log("\n========================================");
  console.log("PDF PROXY REQUEST");
  console.log("========================================");
  console.log("Requested PDF URL:", pdfUrl);
  console.log("Full request URL:", url.href);
  try {
    await ensureCacheDir();
    const fileName = generateFileName(pdfUrl);
    const filePath = path.join(PDF_CACHE_DIR, fileName);
    console.log("Cache filename (hash):", fileName);
    console.log("Cache file path:", filePath);
    let pdfBuffer;
    try {
      pdfBuffer = await fs.readFile(filePath);
      console.log("✅ Serving cached PDF from disk");
      console.log("   File size:", pdfBuffer.length, "bytes");
      console.log("========================================\n");
    } catch (err) {
      console.log("⬇️  PDF not cached, downloading from Congress.gov...");
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        console.log("❌ Failed to fetch PDF:", response.status);
        console.log("========================================\n");
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }
      pdfBuffer = await response.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(pdfBuffer));
      console.log("✅ Downloaded and cached PDF");
      console.log("   File size:", pdfBuffer.byteLength, "bytes");
      console.log("========================================\n");
    }
    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="bill.pdf"',
        "Cache-Control": "public, max-age=86400"
        // Cache for 24 hours
      }
    });
  } catch (error) {
    console.error("Error handling PDF:", error);
    return json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export { GET, OPTIONS };
//# sourceMappingURL=_server-B8yXEAbK.js.map
