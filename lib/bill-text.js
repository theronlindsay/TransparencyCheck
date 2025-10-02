import { fetchBillDetail } from "./congress.js";

const SEGMENT_TYPE_MAP = {
  "house-bill": "hr",
  "senate-bill": "s",
  "house-resolution": "hres",
  "senate-resolution": "sres",
  "house-concurrent-resolution": "hconres",
  "senate-concurrent-resolution": "sconres",
  "house-joint-resolution": "hjres",
  "senate-joint-resolution": "sjres",
};

const TYPE_REGEX_MAP = {
  HR: "hr",
  "H.R.": "hr",
  S: "s",
  "S.": "s",
  HRES: "hres",
  "H.RES.": "hres",
  HCONRES: "hconres",
  "H.CON.RES.": "hconres",
  SCONRES: "sconres",
  "S.CON.RES.": "sconres",
  HJRES: "hjres",
  "H.J.RES.": "hjres",
  SJRES: "sjres",
  "S.J.RES.": "sjres",
};

const FORMAT_PRIORITY = ["text", "html", "xml", "pdf", "unknown"];

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function parseIdentifiersFromUrl(fullTextUrl) {
  if (!fullTextUrl) return null;

  try {
    const url = new URL(fullTextUrl);
    const match = url.pathname.match(
      /\/(\d+)(?:st|nd|rd|th)-congress\/([^/]+)\/(\d+)/i
    );

    if (!match) return null;

    const congress = Number.parseInt(match[1], 10);
    const segment = match[2].toLowerCase();
    const billNumber = match[3];
    const billTypeCode = SEGMENT_TYPE_MAP[segment];

    if (!Number.isInteger(congress) || !billTypeCode) {
      return null;
    }

    return { congress, billTypeCode, billNumber };
  } catch (error) {
    return null;
  }
}

function parseIdentifiersFromNumber(number) {
  if (!number) return null;

  const cleaned = number.replace(/[^A-Z0-9.\s-]/gi, "");
  const match = cleaned.match(/([A-Z.]+)\s*-?\s*(\d+)/);
  if (!match) return null;

  const typeSegment = TYPE_REGEX_MAP[match[1]];
  const billNumber = match[2];

  if (!typeSegment || !billNumber) return null;

  return { billTypeCode: typeSegment, billNumber };
}

function deriveIdentifiers(bill) {
  const fromUrl = parseIdentifiersFromUrl(bill?.fullTextUrl);
  if (fromUrl) return fromUrl;

  const fromNumber = parseIdentifiersFromNumber(bill?.number);
  if (!fromNumber) return null;

  return {
    ...fromNumber,
    congress: undefined,
  };
}

function collectEntries(detail) {
  const collections = [];

  for (const candidate of [detail?.texts, detail?.textVersions, detail?.bill?.texts]) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      collections.push(...candidate);
    } else if (Array.isArray(candidate?.items)) {
      collections.push(...candidate.items);
    }
  }

  return collections;
}

function extractFormatsFromEntry(entry) {
  const candidates = [];

  const directUrl = pickString(
    entry?.gpoUrl,
    entry?.htmlUrl,
    entry?.url,
    entry?.downloadUrl,
    entry?.link,
    entry?.pdfUrl,
    entry?.txtUrl
  );

  if (directUrl) {
    candidates.push({
      url: directUrl,
      label: pickString(entry?.label, entry?.type, entry?.name, entry?.format),
    });
  }

  const nestedCollections = [entry?.formats, entry?.files, entry?.documents, entry?.items];
  for (const collection of nestedCollections) {
    if (!Array.isArray(collection)) continue;

    for (const format of collection) {
      const url = pickString(format?.url, format?.downloadUrl, format?.link);
      if (!url) continue;
      candidates.push({
        url,
        label: pickString(
          format?.type,
          format?.label,
          format?.format,
          format?.name,
          format?.description
        ),
      });
    }
  }

  return candidates;
}

function normalizeCandidate(candidate) {
  const url = candidate.url;
  const label = candidate.label?.toLowerCase?.() ?? "";
  const urlLower = url?.toLowerCase?.() ?? "";

  const extensionMatch = urlLower.match(/\.([a-z0-9]+)(?:\?|$)/);
  const extension = extensionMatch ? extensionMatch[1] : "";

  const modeChecks = [
    {
      mode: "html",
      match:
        label.includes("html") ||
        label.includes("htm") ||
        extension === "html" ||
        extension === "htm",
    },
    {
      mode: "text",
      match:
        label.includes("plain") ||
        label.includes("text") ||
        label.includes("txt") ||
        extension === "txt",
    },
    {
      mode: "xml",
      match: label.includes("xml") || extension === "xml",
    },
    {
      mode: "pdf",
      match: label.includes("pdf") || extension === "pdf",
    },
  ];

  for (const check of modeChecks) {
    if (check.match) {
      return { url, mode: check.mode, label: candidate.label };
    }
  }

  return { url, mode: "unknown", label: candidate.label };
}

function dedupeCandidates(candidates) {
  const seen = new Map();
  for (const candidate of candidates) {
    if (!candidate.url) continue;
    if (!seen.has(candidate.url)) {
      seen.set(candidate.url, candidate);
    }
  }
  return Array.from(seen.values());
}

function selectBestCandidate(detail, fallbackUrl) {
  const entries = collectEntries(detail);
  const candidates = [];

  for (const entry of entries) {
    candidates.push(...extractFormatsFromEntry(entry));
  }

  if (fallbackUrl) {
    candidates.push({ url: fallbackUrl, label: "Original link" });
  }

  const uniqueCandidates = dedupeCandidates(candidates).map(normalizeCandidate);
  if (uniqueCandidates.length === 0) {
    return null;
  }

  uniqueCandidates.sort((a, b) => {
    const priorityA = FORMAT_PRIORITY.indexOf(a.mode);
    const priorityB = FORMAT_PRIORITY.indexOf(b.mode);
    return priorityA - priorityB;
  });

  return uniqueCandidates[0];
}

function extractBody(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return html;
  return bodyMatch[1];
}

function stripDangerousHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?<\/embed>/gi, "");
}

function htmlToParagraphHtml(html) {
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (preMatch) {
    const cleaned = decodeEntities(preMatch[1].replace(/<[^>]+>/g, ""));
    return `<pre>${escapeHtml(cleaned.trim())}</pre>`;
  }

  const withoutDangerous = stripDangerousHtml(html);
  const withBreaks = withoutDangerous
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, "</$1>\n\n")
    .replace(/<(p|div|section|article|li|h[1-6]|tr)[^>]*>/gi, "\n\n");

  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  const normalized = decodeEntities(stripped).replace(/\n{3,}/g, "\n\n").trim();

  if (!normalized) return "";

  const paragraphs = normalized.split(/\n{2,}/g);
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function plainTextToHtml(text) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  return `<pre>${escapeHtml(normalized)}</pre>`;
}

function inferExtensionFromCandidate(candidate) {
  if (!candidate?.url) return "txt";
  switch (candidate.mode) {
    case "pdf":
      return "pdf";
    case "html":
      return "html";
    case "xml":
      return "xml";
    case "text":
      return "txt";
    default: {
      const match = candidate.url.match(/\.([a-z0-9]+)(?:\?|$)/i);
      return match ? match[1].toLowerCase() : "txt";
    }
  }
}

function buildFilename(bill, candidate) {
  const raw = pickString(bill?.number, bill?.id, "bill");
  const sanitized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = sanitized || "bill-text";
  const extension = inferExtensionFromCandidate(candidate);
  return `${base}.${extension}`;
}

async function resolveBillTextCandidate(bill) {
  const fallbackUrl = bill?.fullTextUrl ?? null;
  const identifiers = deriveIdentifiers(bill);

  if (!identifiers || !identifiers.billNumber) {
    return {
      fallbackUrl,
      reason: "Missing bill identifiers",
    };
  }

  if (!identifiers.congress) {
    const inferred = parseIdentifiersFromUrl(fallbackUrl);
    if (inferred?.congress) {
      identifiers.congress = inferred.congress;
    } else {
      return {
        fallbackUrl,
        reason: "Unable to determine congress number for bill",
      };
    }
  }

  let detail;
  try {
    detail = await fetchBillDetail(
      identifiers.congress,
      identifiers.billTypeCode,
      identifiers.billNumber
    );
  } catch (error) {
    return {
      fallbackUrl,
      reason: `Failed to load bill detail: ${error.message}`,
    };
  }

  const candidate = selectBestCandidate(detail, fallbackUrl);

  if (!candidate) {
    return {
      fallbackUrl,
      detail,
      reason: "No text formats were returned for this bill.",
    };
  }

  return {
    fallbackUrl,
    detail,
    candidate,
  };
}

export async function getBillTextAsset(bill) {
  const { fallbackUrl, candidate, reason } = await resolveBillTextCandidate(bill);

  if (!candidate) {
    const message = reason ?? "Bill text unavailable.";
    return {
      available: false,
      reason: message,
      fallbackUrl,
    };
  }

  return {
    available: true,
    url: candidate.url,
    mode: candidate.mode,
    label: candidate.label ?? null,
    filename: buildFilename(bill, candidate),
    fallbackUrl,
  };
}

export async function getBillFullText(bill) {
  const resolution = await resolveBillTextCandidate(bill);
  const { fallbackUrl, candidate, reason } = resolution;

  const downloadUrl = bill?.id
    ? `/api/bills/${bill.id}/download`
    : candidate?.url ?? fallbackUrl ?? null;

  if (!candidate) {
    const message = reason ?? "Bill text unavailable.";
    return {
      available: false,
      reason: message,
      sourceUrl: fallbackUrl,
      downloadUrl,
    };
  }

  if (candidate.mode === "pdf" || candidate.mode === "unknown") {
    return {
      available: false,
      reason: "Only a downloadable document is available for this bill.",
      sourceUrl: candidate.url,
      downloadUrl,
      fetchedAt: new Date().toISOString(),
    };
  }

  const acceptHeader =
    candidate.mode === "html"
      ? "text/html,application/xhtml+xml"
      : candidate.mode === "xml"
        ? "application/xml,text/xml"
        : "text/plain";

  let response;
  try {
    response = await fetch(candidate.url, {
      headers: {
        Accept: acceptHeader,
      },
    });
  } catch (error) {
    return {
      available: false,
      reason: `Failed to download bill text: ${error.message}`,
      sourceUrl: candidate.url,
      downloadUrl,
    };
  }

  if (!response.ok) {
    return {
      available: false,
      reason: `Congress.gov returned ${response.status} ${response.statusText}`,
      sourceUrl: candidate.url,
      downloadUrl,
    };
  }

  const raw = await response.text();
  let html;

  if (candidate.mode === "html") {
    const bodyHtml = extractBody(raw);
    html = htmlToParagraphHtml(bodyHtml);
  } else {
    html = plainTextToHtml(raw);
  }

  return {
    available: true,
    format: candidate.mode,
    sourceUrl: candidate.url,
    downloadUrl,
    html,
    fetchedAt: new Date().toISOString(),
  };
}
