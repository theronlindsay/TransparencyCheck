import Link from "next/link";
import { getBills } from "@/lib/bills";

export default async function Home() {
  const bills = await getBills();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 sm:px-8 lg:px-12">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">
            Transparency Tracker
          </p>
          <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
            Bills in focus
          </h1>
          <p className="max-w-3xl text-lg text-slate-600">
            Follow key legislation in Congress with
            at-a-glance summaries, status updates, and quick links to the full text.
          </p>
        </header>

        <section id="bills" className="grid gap-8 md:grid-cols-2">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-xl shadow-slate-300/40 backdrop-blur transition-transform duration-200 hover:-translate-y-1 hover:shadow-2xl"
            >
              <Link
                href={`/bills/${bill.id}`}
                className="absolute inset-0 z-10 rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                aria-label={`View details for ${bill.title}`}
              >
                <span className="sr-only">View bill</span>
              </Link>
              <article className="relative z-0 flex h-full flex-col gap-6 p-8">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">
                    {bill.number}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                    {bill.statusTag}
                  </span>
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {bill.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {bill.summary}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">{bill.sponsor}</p>
                  <a
                    href={bill.fullTextUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="relative z-20 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Full text
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
              </article>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
