import Link from "next/link";
import { notFound } from "next/navigation";
import { getBillById } from "@/lib/bills";

export default async function BillDetailPage({ params }) {
  const { billId } = await params;
  const bill = await getBillById(billId);

  if (!bill) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            ← Back to bills
          </Link>
          <Link
            href={`/bills/${bill.id}/full-text`}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Read full text
            <span aria-hidden="true">⤵</span>
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-300/40 backdrop-blur">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">
              {bill.number}
            </span>
            <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
              {bill.title}
            </h1>
            <p className="text-lg leading-relaxed text-slate-600">
              {bill.summaryLong}
            </p>
          </div>

          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Primary sponsor
              </dt>
              <dd className="mt-1 text-base font-medium text-slate-900">
                {bill.sponsor}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Committee of jurisdiction
              </dt>
              <dd className="mt-1 text-base font-medium text-slate-900">
                {bill.committee}
              </dd>
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

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-300/30 backdrop-blur">
            <h2 className="text-xl font-semibold text-slate-900">Voting progress</h2>
            <p className="mt-2 text-sm text-slate-600">
              Track committee and floor activity across both chambers.
            </p>
            <ul className="mt-6 space-y-4">
              {bill.votes.map((vote) => (
                <li
                  key={`${vote.chamber}-${vote.stage}`}
                  className="rounded-2xl border border-indigo-100/80 bg-indigo-50/60 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                        {vote.chamber}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {vote.stage}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm">
                      {vote.status}
                    </span>
                  </div>
                  {vote.detail && (
                    <p className="mt-3 text-sm text-slate-600">{vote.detail}</p>
                  )}
                  {(vote.yea !== null || vote.nay !== null) && (
                    <div className="mt-4 flex gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <span>
                        Yea{" "}
                        <span className="ml-1 text-base font-semibold text-slate-900">
                          {vote.yea ?? "—"}
                        </span>
                      </span>
                      <span>
                        Nay{" "}
                        <span className="ml-1 text-base font-semibold text-slate-900">
                          {vote.nay ?? "—"}
                        </span>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-300/30 backdrop-blur">
            <h2 className="text-xl font-semibold text-slate-900">Upcoming schedule</h2>
            <p className="mt-2 text-sm text-slate-600">
              Key hearings and floor activity to monitor.
            </p>
            <ul className="mt-6 space-y-4">
              {bill.schedule.map((event) => (
                <li
                  key={`${event.chamber}-${event.date}-${event.title}`}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm shadow-slate-200/50"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                    {event.chamber}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {event.title}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{event.date}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {event.location}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {event.note}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-300/40 backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Latest news coverage</h2>
              <p className="text-sm text-slate-600">
                Curated reportage and analysis surrounding the bill.
              </p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
              Updated daily
            </span>
          </div>
          <ul className="mt-6 space-y-5">
            {bill.news.map((item) => (
              <li
                key={item.url}
                className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm shadow-slate-200/60"
              >
                <div className="flex flex-col gap-2">
                  <p className="text-base font-semibold text-slate-900">
                    {item.headline}
                  </p>
                  <p className="text-sm font-medium text-slate-500">
                    {item.source} · {item.date}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {item.summary}
                  </p>
                  <div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      Read article
                      <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
