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

const TYPE_ICONS: Record<QuestionType, string> = {
  date_select: "fa-calendar-alt",
  pax_select: "fa-users",
  multiple_choice: "fa-list-ul",
  multi_select: "fa-check-square",
  yes_no: "fa-toggle-on",
};

function formatDate(d: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

function AnswerSummaryRow({
  q, answers, onEdit,
}: {
  q: Question;
  answers: Answers;
  onEdit: () => void;
}) {
  let answerDisplay = "";

  if (q.type === "date_select") {
    const from = answers.dates?.from;
    const to = answers.dates?.to;
    answerDisplay = from && to ? `${formatDate(from)} → ${formatDate(to)}` : from ? formatDate(from) : "—";
  } else if (q.type === "pax_select") {
    const p = answers.pax ?? 1;
    answerDisplay = `${p} person${p > 1 ? "s" : ""}`;
  } else {
    const selected = answers.choices[q.id] || [];
    const options = q.type === "yes_no" ? YES_NO_OPTIONS : (q.options || []);
    const labels = selected.map(id => options.find(o => o.id === id)?.label || id).filter(Boolean);
    answerDisplay = labels.join(", ") || "—";
  }

  const hasAnswer = answerDisplay && answerDisplay !== "—";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
        <i className={`fas ${TYPE_ICONS[q.type]} text-emerald-600 text-xs`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase text-slate-400 leading-none mb-0.5">
          {q.text || "Question"}
        </p>
        <p className={`text-xs font-black truncate ${hasAnswer ? "text-[#062c24]" : "text-slate-300"}`}>
          {answerDisplay}
        </p>
      </div>
      <button
        onClick={onEdit}
        className="text-[9px] font-black text-emerald-600 hover:text-emerald-800 uppercase shrink-0 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
      >
        Edit
      </button>
    </div>
  );
}

export default function WizardClient({ slug }: { slug: string }) {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [config, setConfig] = useState<WizardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ pax: 1, choices: {} });
  const [completing, setCompleting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [gear, setGear] = useState<{ id: string; specs?: { maxPax?: number } }[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, "vendors"), where("slug", "==", slug))
        );
        if (snap.empty) { window.location.href = `/shop/${slug}`; return; }
        const vId = snap.docs[0].id;
        const vData = snap.docs[0].data();
        setVendorId(vId);
        setVendorName(vData.name || "");

        const [configSnap, gearSnap] = await Promise.all([
          getDoc(doc(db, "vendors", vId, "wizard", "config")),
          getDocs(query(collection(db, "gear"), where("vendorId", "==", vId))),
        ]);

        setGear(
          gearSnap.docs
            .filter(d => !d.data().deleted)
            .map(d => ({ id: d.id, specs: d.data().specs }))
        );

        if (!configSnap.exists() || !configSnap.data()?.enabled) {
          window.location.href = `/shop/${slug}`; return;
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

  // Filter out questions with no text or no valid options
  const questions = config.questions.filter(q => {
    if (!q.text?.trim()) return false;
    if (q.type === "multiple_choice" || q.type === "multi_select") {
      return (q.options || []).some(o => o.label?.trim());
    }
    return true;
  });

  if (questions.length === 0) {
    window.location.href = `/shop/${slug}`;
    return null;
  }

  const currentQ = questions[step];
  const isLastStep = step === questions.length - 1;
  const progress = showSummary ? 100 : ((step + 1) / questions.length) * 100;

  function getOptions(q: Question): QuestionOption[] {
    if (q.type === "yes_no") return YES_NO_OPTIONS;
    // Filter out options with empty labels
    return (q.options || []).filter(o => o.label?.trim());
  }

  function isAnswered(): boolean {
    if (!currentQ) return false;
    if (currentQ.type === "date_select") return !!(answers.dates?.from && answers.dates?.to);
    if (currentQ.type === "pax_select") return !!(answers.pax && answers.pax > 0);
    return (answers.choices[currentQ.id]?.length ?? 0) > 0;
  }

  function toggleChoice(qId: string, oId: string, isMulti: boolean) {
    setAnswers((prev) => {
      const current = prev.choices[qId] || [];
      const next = isMulti
        ? current.includes(oId) ? current.filter(x => x !== oId) : [...current, oId]
        : current[0] === oId ? [] : [oId];
      return { ...prev, choices: { ...prev.choices, [qId]: next } };
    });
  }

  function handleNext() {
    if (isLastStep) {
      setShowSummary(true);
    } else {
      setStep(s => s + 1);
    }
  }

  async function complete() {
    if (!config || !vendorId || completing) return;
    setCompleting(true);

    const result = scoreWizard(answers, config.rules, gear);
    const sessionId = crypto.randomUUID();

    setDoc(doc(db, "wizardSessions", sessionId), {
      vendorId, vendorSlug: slug, answers,
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

  // ─── SUMMARY SCREEN ───────────────────────────────────────────────────────
  if (showSummary) {
    return (
      <div className="min-h-screen bg-[#062c24] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <header className="px-5 pt-10 pb-5">
          <button
            onClick={() => setShowSummary(false)}
            className="flex items-center gap-2 text-white/60 hover:text-white text-[11px] font-bold mb-5 transition-colors"
          >
            <i className="fas fa-arrow-left text-xs" /> Edit Answers
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center">
              <i className="fas fa-magic text-white text-sm" />
            </div>
            <h1 className="text-lg font-black text-white uppercase tracking-tight">Your Trip Plan</h1>
          </div>
          <p className="text-[11px] text-white/60 font-medium ml-11">
            Here's what we'll use to find your gear
          </p>
          {/* Full progress bar */}
          <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full w-full" />
          </div>
        </header>

        {/* Summary card */}
        <main className="flex-1 px-5 py-2">
          <div className="bg-white rounded-3xl overflow-hidden shadow-xl">
            {/* Card header */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                Trip Summary · {vendorName}
              </p>
            </div>
            {/* Answer rows */}
            <div className="px-5">
              {questions.map((q, idx) => (
                <AnswerSummaryRow
                  key={q.id}
                  q={q}
                  answers={answers}
                  onEdit={() => { setShowSummary(false); setStep(idx); }}
                />
              ))}
            </div>
            {/* Card footer note */}
            <div className="px-5 py-4 bg-emerald-50/60">
              <p className="text-[9px] text-emerald-700 font-semibold">
                <i className="fas fa-info-circle mr-1" />
                We'll highlight the best matching gear at the top of the shop — you can still browse everything.
              </p>
            </div>
          </div>
        </main>

        {/* CTA */}
        <div className="px-5 pb-10 pt-4">
          <button
            onClick={complete}
            disabled={completing}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase text-[13px] tracking-widest hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
          >
            {completing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Finding your gear…
              </>
            ) : (
              <>
                <i className="fas fa-magic" />
                Find My Gear
              </>
            )}
          </button>
          <button
            onClick={() => { setShowSummary(false); setStep(0); setAnswers({ pax: 1, choices: {} }); }}
            className="w-full mt-3 text-[10px] font-black text-white/40 hover:text-white/70 uppercase text-center transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  // ─── QUESTION SCREEN ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#062c24] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="px-5 pt-10 pb-5">
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : window.history.back()}
          className="flex items-center gap-2 text-white/60 hover:text-white text-[11px] font-bold mb-5 transition-colors"
        >
          <i className="fas fa-arrow-left text-xs" /> {step > 0 ? "Back" : "Exit"}
        </button>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-base font-black text-white uppercase tracking-tight">{config.title}</h1>
          <span className="text-[10px] text-white/50 font-bold tabular-nums">
            {step + 1} / {questions.length}
          </span>
        </div>
        {/* Segmented progress */}
        <div className="mt-3 flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-emerald-400" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Question card */}
      <main className="flex-1 px-5 py-4">
        {currentQ && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-xl">
            {/* Question header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <i className={`fas ${TYPE_ICONS[currentQ.type]} text-emerald-600 text-[10px]`} />
                </span>
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  {currentQ.type === "date_select" ? "Dates"
                    : currentQ.type === "pax_select" ? "Group Size"
                    : currentQ.type === "multi_select" ? "Select all that apply"
                    : "Choose one"}
                </span>
              </div>
              <p className="text-base font-black text-[#062c24] leading-snug">{currentQ.text}</p>
            </div>

            {/* Answer area */}
            <div className="px-6 py-5">

              {/* Date range picker */}
              {currentQ.type === "date_select" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest">
                      <i className="fas fa-sign-in-alt mr-1" /> Check-in
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
                      className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-[#062c24] outline-none focus:border-emerald-400 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest">
                      <i className="fas fa-sign-out-alt mr-1" /> Return
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
                      className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-[#062c24] outline-none focus:border-emerald-400 transition-colors"
                    />
                  </div>
                  {answers.dates?.from && answers.dates?.to && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
                      <i className="fas fa-check-circle text-emerald-500 text-xs" />
                      <p className="text-[10px] text-emerald-700 font-bold">
                        {formatDate(answers.dates.from)} → {formatDate(answers.dates.to)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Pax stepper */}
              {currentQ.type === "pax_select" && (
                <div className="py-4">
                  <div className="flex items-center justify-center gap-8">
                    <button
                      onClick={() => setAnswers(prev => ({ ...prev, pax: Math.max(1, (prev.pax || 1) - 1) }))}
                      className="w-14 h-14 rounded-2xl bg-slate-100 text-[#062c24] text-2xl font-black hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center border-2 border-slate-200"
                    >
                      −
                    </button>
                    <div className="text-center min-w-[80px]">
                      <span className="text-5xl font-black text-[#062c24] tabular-nums">{answers.pax || 1}</span>
                      <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-widest">
                        {(answers.pax || 1) === 1 ? "person" : "persons"}
                      </p>
                    </div>
                    <button
                      onClick={() => setAnswers(prev => ({ ...prev, pax: Math.min(20, (prev.pax || 1) + 1) }))}
                      className="w-14 h-14 rounded-2xl bg-[#062c24] text-white text-2xl font-black hover:bg-emerald-800 active:scale-95 transition-all flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  {(answers.pax || 1) >= 6 && (
                    <p className="text-center text-[10px] text-amber-600 font-bold mt-3">
                      <i className="fas fa-info-circle mr-1" />
                      Large group — we'll suggest suitable tents
                    </p>
                  )}
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
                        className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[11px] font-black uppercase border-2 transition-all active:scale-95 ${
                          selected
                            ? "bg-[#062c24] text-white border-[#062c24] shadow-lg shadow-[#062c24]/20"
                            : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-[#062c24]"
                        }`}
                      >
                        {selected && <i className="fas fa-check text-[9px]" />}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <div className="px-5 pb-10 pt-2">
        <button
          onClick={handleNext}
          disabled={!isAnswered() || completing}
          className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase text-[12px] tracking-widest hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
        >
          {isLastStep ? (
            <>Review Answers <i className="fas fa-arrow-right text-xs" /></>
          ) : (
            <>Next <i className="fas fa-arrow-right text-xs" /></>
          )}
        </button>
      </div>
    </div>
  );
}
