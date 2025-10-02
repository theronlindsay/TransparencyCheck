import Link from "next/link";
import { notFound } from "next/navigation";
import { getBillById } from "@/lib/bills";
import { getBillFullText } from "@/lib/bill-text";

export const revalidate = 3600;

export default async function BillFullTextPage({ params }) {
  const { billId } = await params;
  const bill = await getBillById(billId);

  if (!bill) {
    notFound();
  }

  const fullText = await getBillFullText(bill);
  const downloadUrl =
    fullText.downloadUrl ?? fullText.sourceUrl ?? bill.fullTextUrl ?? null;
  const isProxyDownload = Boolean(fullText.downloadUrl?.startsWith("/"));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <Link
              href={`/bills/${bill.id}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              ← Back to bill overview
            </Link>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">
                {bill.number}
              </span>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                {bill.title}
              </h1>
              <p className="text-sm text-slate-500">
                Last updated {new Date(bill.updatedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-5 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              {...(isProxyDownload
                ? { download: "" }
                : { target: "_blank", rel: "noreferrer" })}
            >
              {isProxyDownload ? "Download source document" : "View source document"}
              <span aria-hidden="true">{isProxyDownload ? "⬇" : "↗"}</span>
            </a>
          ) : null}
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-300/40 backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-900">Bill overview</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Sponsor
              </dt>
              <dd className="mt-1 text-base font-medium text-slate-900">{bill.sponsor}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Committee
              </dt>
              <dd className="mt-1 text-base font-medium text-slate-900">{bill.committee}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Status
              </dt>
              <dd className="mt-1 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-600">
                {bill.statusTag}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Latest action
              </dt>
              <dd className="mt-1 text-base text-slate-900">{bill.latestAction}</dd>
            </div>
          </dl>
        </section>

        <section className="bill-reader rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-2xl shadow-slate-300/40 backdrop-blur">
          <header className="flex flex-col gap-2 border-b border-slate-200 pb-6">
            <h2 className="text-2xl font-semibold text-slate-900">Full bill text</h2>
            <p className="text-sm text-slate-600">
              This view normalizes the official Congress.gov text for easier mobile and desktop reading. Use the source document link for citation-ready formatting.
            </p>
            {fullText.available ? (
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Format extracted from {fullText.format?.toUpperCase?.() ?? "HTML"} · Retrieved {new Date(fullText.fetchedAt).toLocaleString()}
              </p>
            ) : (
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Source document required · Retrieved {new Date(
                  fullText.fetchedAt ?? Date.now()
                ).toLocaleString()}
              </p>
            )}
          </header>

          {fullText.available ? (
            <article
              className="mt-8 space-y-6 text-base leading-relaxed text-slate-800 [&_p]:m-0 [&_h1]:mt-12 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-xl [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:bg-slate-100 [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-slate-200 [&_pre]:p-6 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:leading-relaxed [&_pre]:whitespace-pre-wrap [&_pre]:overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-slate-200 [&_td]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2"
              dangerouslySetInnerHTML={{ __html: fullText.html }}
            />
          ) : (
            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-amber-900">
              <h3 className="text-lg font-semibold">Full text unavailable in-line</h3>
              <p className="text-sm">
                We couldn&apos;t automatically convert this bill&apos;s text. Use the download link above to fetch the official file directly and save or print as needed.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
