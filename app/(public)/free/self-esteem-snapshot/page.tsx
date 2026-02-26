import type { Metadata } from "next";
import { buildStaticPageMetadata } from "@/lib/metadata";
import { Download, CheckCircle2, ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata(
    "/free/self-esteem-snapshot",
    "Free Self-Esteem Snapshot",
    "Take this free self-assessment to understand where you stand right now — which areas feel strong and which might benefit from focused attention.",
    "/images/hero-home.jpg"
  );
}

const DIMENSIONS = [
  {
    title: "Self-Worth",
    description:
      "How you value yourself regardless of achievements or external validation.",
  },
  {
    title: "Self-Trust",
    description:
      "How much you rely on your own judgement and believe in your capability.",
  },
  {
    title: "Boundaries",
    description:
      "How well you protect your energy, say no, and honour your own needs.",
  },
  {
    title: "Inner Dialogue",
    description:
      "How you talk to yourself daily — kind encouragement or harsh criticism.",
  },
  {
    title: "Resilience",
    description:
      "How you handle setbacks, criticism, and uncomfortable emotions.",
  },
];

export default function SelfEsteemSnapshotPage() {
  return (
    <div className="bg-cream-50 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-400/10 via-cream-50 to-brand-100/20 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-500">
            Free Assessment
          </p>
          <h1 className="font-heading text-3xl font-bold text-gray-900 sm:text-4xl lg:text-5xl">
            Self-Esteem Snapshot
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            A short self-assessment that helps you understand where you stand
            right now — which areas feel strong and which might benefit from
            some focused attention.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/downloads/self-esteem-snapshot.pdf"
              download
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
            >
              <Download className="h-4 w-4" />
              Download Free PDF
            </a>
            <Link
              href="/book?type=free_consultation"
              className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-white px-6 py-3 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              <BookOpen className="h-4 w-4" />
              Book Free Consultation
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            No sign-up required · Takes about 5 minutes · Print-friendly PDF
          </p>
        </div>
      </section>

      {/* What You'll Discover */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center font-heading text-2xl font-bold text-gray-900 sm:text-3xl">
            5 Dimensions of Self-Esteem
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600">
            The assessment covers five core areas. For each one you&apos;ll
            rate yourself on five statements — giving you a clear picture
            of where to focus.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DIMENSIONS.map((dim, i) => (
              <div
                key={dim.title}
                className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <h3 className="font-heading text-base font-semibold text-gray-900">
                    {dim.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-gray-600">
                  {dim.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-brand-50/50 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center font-heading text-2xl font-bold text-gray-900">
            How It Works
          </h2>
          <div className="mt-8 space-y-5">
            {[
              {
                step: "1",
                text: "Download the PDF and grab a pen",
              },
              {
                step: "2",
                text: "Rate each statement honestly from 1 to 5 — there are no wrong answers",
              },
              {
                step: "3",
                text: "Add up your section scores to see your Snapshot result",
              },
              {
                step: "4",
                text: "Read the personalised guide to understand what your scores mean",
              },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-400 text-sm font-bold text-white">
                  {step}
                </span>
                <p className="pt-1 text-gray-700">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <a
              href="/downloads/self-esteem-snapshot.pdf"
              download
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
            >
              <Download className="h-4 w-4" />
              Get Your Free Snapshot
            </a>
          </div>
        </div>
      </section>

      {/* Retake CTA */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-heading text-2xl font-bold text-gray-900">
            Taking It Again?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-600">
            The Snapshot is designed to be retaken periodically. Download a
            fresh copy, compare your scores over time, and celebrate the
            growth you might not have noticed otherwise.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/downloads/self-esteem-snapshot.pdf"
              download
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
            >
              <Download className="h-4 w-4" />
              Download Fresh Copy
            </a>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              Explore Courses
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
