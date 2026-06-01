"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { scoreWizard } from "@/lib/wizardScoring";

type QuestionType = "date_select" | "pax_select" | "multiple_choice" | "multi_select" | "yes_no";
type QuestionOption = { id: string; label: string };
type Question = {
  id: string;
  type: QuestionType;
  text: string;
  options?: QuestionOption[];
};
type Rule = {
  id: string;
  conditions: { questionId: string; optionId: string }[];
  suggestedItemIds: string[];
  addonItemIds: string[];
};
type WizardConfig = {
  enabled: boolean;
  title: string;
  questions: Question[];
  rules: Rule[];
};
type Answers = {
  dates?: { from: string; to: string };
  pax?: number;
  choices: Record<string, string[]>;
};

const YES_NO_OPTIONS: QuestionOption[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

export default function WizardClient({ slug }: { slug: string }) {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [config, setConfig] = useState<WizardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ pax: 1, choices: {} });
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, "vendors"), where("slug", "==", slug))
        );
        if (snap.empty) {
          window.location.href = `/shop/${slug}`;
          return;
        }
        const vId = snap.docs[0].id;
        setVendorId(vId);

        const configSnap = await getDoc(
          doc(db, "vendors", vId, "wizard", "config")
        );
        if (!configSnap.exists() || !configSnap.data()?.enabled) {
          window.location.href = `/shop/${slug}`;
          return;
        }
        const data = configSnap.data();
        setConfig({
          enabled: data.enabled ?? false,
          title: data.title ?? "Plan Your Perfect Camp",
          questions: data.questions ?? [],
          rules: data.rules ?? [],
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading || !config) {
    return (
      <div className="fixed inset-0 bg-[#062c24] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const questions = config.questions;
  const currentQ = questions[step];
  const isLastStep = step === questions.length - 1;
  const progress = ((step + 1) / questions.length) * 100;

  function getOptions(q: Question): QuestionOption[] {
    if (q.type === "yes_no") return YES_NO_OPTIONS;
    return q.options || [];
  }

  function isAnswered(): boolean {
    if (!currentQ) return false;
    if (currentQ.type === "date_select") {
      return !!(answers.dates?.from && answers.dates?.to);
    }
    if (currentQ.type === "pax_select") {
      return !!(answers.pax && answers.pax > 0);
    }
    return (answers.choices[currentQ.id]?.length ?? 0) > 0;
  }

  function toggleChoice(qId: string, oId: string, isMulti: boolean) {
    setAnswers((prev) => {
      const current = prev.choices[qId] || [];
      let next: string[];
      if (isMulti) {
        next = current.includes(oId)
          ? current.filter((x) => x !== oId)
          : [...current, oId];
      } else {
        next = current[0] === oId ? [] : [oId];
      }
      return { ...prev, choices: { ...prev.choices, [qId]: next } };
    });
  }

  async function complete() {
    if (!config || !vendorId || completing) return;
    setCompleting(true);

    const result = scoreWizard(answers, config.rules, []);
    const sessionId = crypto.randomUUID();

    setDoc(doc(db, "wizardSessions", sessionId), {
      vendorId,
      vendorSlug: slug,
      answers,
      resolvedItemIds: result.rankedItemIds,
      resolvedAddonIds: result.addonItemIds,
      createdAt: serverTimestamp(),
      convertedToOrder: false,
    }).catch(() => {});

    const params = new URLSearchParams();
    if (result.rankedItemIds.length) params.set("rec", result.rankedItemIds.join(","));
    if (result.addonItemIds.length) params.set("addon", result.addonItemIds.join(","));
    if (answers.pax != null) params.set("pax", String(answers.pax));
    if (answers.dates?.from) params.set("from", answers.dates.from);
    if (answers.dates?.to) params.set("to", answers.dates.to);
    params.set("wiz", sessionId);

    window.location.href = `/shop/${slug}?${params.toString()}`;
  }

  return (
    <div
      className="min-h-screen bg-[#062c24] flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <header className="px-5 pt-10 pb-4">
        <button
          onClick={() => window.history.back()}
          className="text-white/60 hover:text-white text-sm mb-4 flex items-center gap-2"
        >
          <i className="fas fa-arrow-left text-xs" /> Back
        </button>
        <h1 className="text-xl font-black text-white uppercase">{config.title}</h1>
        <p className="text-[10px] text-white/60 mt-1">
          Step {step + 1} of {questions.length}
        </p>
        {/* Progress bar */}
        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Question card */}
      <main className="flex-1 px-5 py-6">
        {currentQ && (
          <div className="bg-white rounded-3xl p-6">
            <p className="text-base font-black text-[#062c24] mb-5">{currentQ.text}</p>

            {/* Date range picker */}
            {currentQ.type === "date_select" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">
                    Check-in Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={answers.dates?.from || ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        dates: { from: e.target.value, to: prev.dates?.to || "" },
                      }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#062c24] outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">
                    Return Date
                  </label>
                  <input
                    type="date"
                    min={answers.dates?.from || new Date().toISOString().split("T")[0]}
                    value={answers.dates?.to || ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        dates: { from: prev.dates?.from || "", to: e.target.value },
                      }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#062c24] outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            )}

            {/* Pax stepper */}
            {currentQ.type === "pax_select" && (
              <div className="flex items-center justify-center gap-6 py-4">
                <button
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      pax: Math.max(1, (prev.pax || 1) - 1),
                    }))
                  }
                  className="w-12 h-12 rounded-full bg-slate-100 text-[#062c24] text-xl font-black hover:bg-slate-200 transition-colors flex items-center justify-center"
                >
                  −
                </button>
                <div className="text-center">
                  <span className="text-4xl font-black text-[#062c24]">
                    {answers.pax || 1}
                  </span>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">persons</p>
                </div>
                <button
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      pax: Math.min(20, (prev.pax || 1) + 1),
                    }))
                  }
                  className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 text-xl font-black hover:bg-emerald-200 transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
            )}

            {/* Choice chips */}
            {(currentQ.type === "multiple_choice" ||
              currentQ.type === "multi_select" ||
              currentQ.type === "yes_no") && (
              <div className="flex flex-wrap gap-2">
                {getOptions(currentQ).map((o) => {
                  const selected = (answers.choices[currentQ.id] || []).includes(o.id);
                  const isMulti = currentQ.type === "multi_select";
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggleChoice(currentQ.id, o.id, isMulti)}
                      className={`px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase border-2 transition-all ${
                        selected
                          ? "bg-[#062c24] text-white border-[#062c24]"
                          : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Navigation */}
      <div className="px-5 pb-10 flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 py-4 rounded-2xl border-2 border-white/30 text-white font-black uppercase text-[11px] hover:border-white/60 transition-colors"
          >
            Back
          </button>
        )}
        <button
          onClick={() => {
            if (isLastStep) {
              complete();
            } else {
              setStep((s) => s + 1);
            }
          }}
          disabled={!isAnswered() || completing}
          className="flex-1 py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase text-[11px] hover:bg-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {completing
            ? "Finding your gear…"
            : isLastStep
            ? "See Recommendations"
            : "Next"}
        </button>
      </div>
    </div>
  );
}
