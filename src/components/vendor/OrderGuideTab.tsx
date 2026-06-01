"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

type GearItem = { id: string; name: string; price: number };

const TYPE_LABELS: Record<QuestionType, string> = {
  date_select: "Date Range (system — pre-fills shop dates)",
  pax_select: "Group Size (system — pax badge on tents)",
  multiple_choice: "Multiple Choice — single answer",
  multi_select: "Multiple Choice — multi answer",
  yes_no: "Yes / No",
};

const SYSTEM_TYPES = new Set<QuestionType>(["date_select", "pax_select"]);

const YES_NO_OPTIONS: QuestionOption[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function getRule(rules: Rule[], qId: string, oId: string): Rule | undefined {
  return rules.find(
    (r) =>
      r.conditions.length === 1 &&
      r.conditions[0].questionId === qId &&
      r.conditions[0].optionId === oId
  );
}

function upsertRule(
  rules: Rule[],
  qId: string,
  oId: string,
  patch: Partial<Pick<Rule, "suggestedItemIds" | "addonItemIds">>
): Rule[] {
  const existing = getRule(rules, qId, oId);
  if (existing) {
    return rules.map((r) => (r.id === existing.id ? { ...r, ...patch } : r));
  }
  return [
    ...rules,
    {
      id: uid(),
      conditions: [{ questionId: qId, optionId: oId }],
      suggestedItemIds: [],
      addonItemIds: [],
      ...patch,
    },
  ];
}

function GearPicker({
  label,
  gearList,
  selected,
  onChange,
}: {
  label: string;
  gearList: GearItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = gearList.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  }

  return (
    <div className="mt-2">
      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{label}</p>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search gear..."
        className="w-full text-[10px] border border-slate-200 rounded-lg px-2 py-1.5 mb-2 outline-none focus:border-emerald-400"
      />
      <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-2">
        {filtered.length === 0 && (
          <p className="text-[9px] text-slate-300 text-center py-2">No gear found</p>
        )}
        {filtered.map((g) => (
          <label key={g.id} className="flex items-center gap-2 cursor-pointer py-0.5">
            <input
              type="checkbox"
              checked={selected.includes(g.id)}
              onChange={() => toggle(g.id)}
              className="accent-emerald-600 shrink-0"
            />
            <span className="text-[10px] font-semibold text-[#062c24] truncate flex-1">
              {g.name}
            </span>
            <span className="text-[9px] text-slate-400 shrink-0">RM{g.price}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map((id) => {
            const g = gearList.find((x) => x.id === id);
            return g ? (
              <span
                key={id}
                className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-200"
              >
                {g.name}
                <button
                  onClick={() => toggle(id)}
                  className="text-emerald-400 hover:text-red-400 ml-0.5 leading-none"
                >
                  ×
                </button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

export default function OrderGuideTab({
  vendorId,
  vendorSlug,
}: {
  vendorId: string;
  vendorSlug?: string;
}) {
  const [config, setConfig] = useState<WizardConfig>({
    enabled: false,
    title: "Plan Your Perfect Camp",
    questions: [],
    rules: [],
  });
  const [gearList, setGearList] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [expandedO, setExpandedO] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const wizardUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/shop/${vendorSlug || vendorId}/wizard`
      : `/shop/${vendorSlug || vendorId}/wizard`;

  useEffect(() => {
    async function load() {
      // Run independently so a config permission error never blocks gear from loading
      const [configResult, gearResult] = await Promise.allSettled([
        getDoc(doc(db, "vendors", vendorId, "wizard", "config")),
        getDocs(query(collection(db, "gear"), where("vendorId", "==", vendorId))),
      ]);
      if (configResult.status === "fulfilled" && configResult.value.exists()) {
        const data = configResult.value.data();
        setConfig({
          enabled: data.enabled ?? false,
          title: data.title ?? "Plan Your Perfect Camp",
          questions: data.questions ?? [],
          rules: data.rules ?? [],
        });
      }
      if (gearResult.status === "fulfilled") {
        setGearList(
          gearResult.value.docs
            .filter((d) => !d.data().deleted)
            .map((d) => ({ id: d.id, name: d.data().name, price: d.data().price } as GearItem))
        );
      }
      setLoading(false);
    }
    load();
  }, [vendorId]);

  useEffect(() => {
    return () => clearTimeout(saveTimer.current);
  }, []);

  const scheduleSave = useCallback(
    (next: WizardConfig) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await setDoc(doc(db, "vendors", vendorId, "wizard", "config"), next);
        } finally {
          setSaving(false);
        }
      }, 1000);
    },
    [vendorId]
  );

  function update(next: WizardConfig) {
    setConfig(next);
    scheduleSave(next);
  }

  function addQuestion() {
    const q: Question = {
      id: uid(),
      type: "multiple_choice",
      text: "",
      options: [{ id: uid(), label: "" }],
    };
    update({ ...config, questions: [...config.questions, q] });
    setExpandedQ(q.id);
  }

  function removeQuestion(qId: string) {
    update({
      ...config,
      questions: config.questions.filter((q) => q.id !== qId),
      rules: config.rules.filter((r) => !r.conditions.some((c) => c.questionId === qId)),
    });
    if (expandedQ === qId) setExpandedQ(null);
  }

  function updateQuestion(qId: string, patch: Partial<Question>) {
    update({
      ...config,
      questions: config.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
    });
  }

  function addOption(qId: string) {
    update({
      ...config,
      questions: config.questions.map((q) =>
        q.id === qId
          ? { ...q, options: [...(q.options || []), { id: uid(), label: "" }] }
          : q
      ),
    });
  }

  function removeOption(qId: string, oId: string) {
    update({
      ...config,
      questions: config.questions.map((q) =>
        q.id === qId
          ? { ...q, options: (q.options || []).filter((o) => o.id !== oId) }
          : q
      ),
      rules: config.rules.filter(
        (r) =>
          !(
            r.conditions.length === 1 &&
            r.conditions[0].questionId === qId &&
            r.conditions[0].optionId === oId
          )
      ),
    });
  }

  function updateOptionLabel(qId: string, oId: string, label: string) {
    update({
      ...config,
      questions: config.questions.map((q) =>
        q.id === qId
          ? {
              ...q,
              options: (q.options || []).map((o) =>
                o.id === oId ? { ...o, label } : o
              ),
            }
          : q
      ),
    });
  }

  function setRuleItems(
    qId: string,
    oId: string,
    field: "suggestedItemIds" | "addonItemIds",
    ids: string[]
  ) {
    update({
      ...config,
      rules: upsertRule(config.rules, qId, oId, { [field]: ids }),
    });
  }

  function getOptionsFor(q: Question): QuestionOption[] {
    if (q.type === "yes_no") return YES_NO_OPTIONS;
    return q.options || [];
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-[#062c24] uppercase">Order Guide</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Help customers find the right gear for their trip
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-[9px] text-slate-400 font-semibold">Saving…</span>
            )}
            <button
              onClick={async () => {
                const next = { ...config, enabled: !config.enabled };
                update(next);
                // Mirror enabled flag on vendor doc for shop-side banner gating
                const { doc: fsDoc, updateDoc } = await import("firebase/firestore");
                updateDoc(fsDoc(db, "vendors", vendorId), { wizardEnabled: next.enabled }).catch(() => {});
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.enabled ? "bg-emerald-500" : "bg-slate-200"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  config.enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">
            Wizard Title
          </label>
          <input
            type="text"
            value={config.title}
            onChange={(e) => update({ ...config, title: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-[#062c24] outline-none focus:border-emerald-400"
            placeholder="Plan Your Perfect Camp"
          />
        </div>

        {/* Shareable link */}
        {vendorSlug && (
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">
              Shareable Link
            </label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-[10px] text-slate-500 font-mono truncate flex-1">
                {wizardUrl}
              </span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(wizardUrl).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="shrink-0 text-[9px] font-black text-emerald-600 hover:text-emerald-800 uppercase"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {config.questions.map((q, qi) => {
          const isExpanded = expandedQ === q.id;
          const isSystem = SYSTEM_TYPES.has(q.type);
          const options = getOptionsFor(q);

          return (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
            >
              {/* Question header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpandedQ(isExpanded ? null : q.id)}
              >
                <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black flex items-center justify-center shrink-0">
                  {qi + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#062c24] truncate">
                    {q.text || "(No question text)"}
                  </p>
                  <p className="text-[9px] text-slate-400">{TYPE_LABELS[q.type]}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeQuestion(q.id);
                    }}
                    className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors"
                  >
                    <i className="fas fa-trash text-[10px]" />
                  </button>
                  <i
                    className={`fas fa-chevron-down text-slate-300 text-[10px] transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>

              {/* Question edit area */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-4">
                  {/* Type selector */}
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">
                      Question Type
                    </label>
                    <select
                      value={q.type}
                      onChange={(e) => {
                        const t = e.target.value as QuestionType;
                        updateQuestion(q.id, {
                          type: t,
                          options:
                            t === "yes_no" || SYSTEM_TYPES.has(t)
                              ? undefined
                              : q.options?.length
                              ? q.options
                              : [{ id: uid(), label: "" }],
                        });
                      }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-semibold outline-none focus:border-emerald-400"
                    >
                      {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Question text */}
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">
                      Question Text
                    </label>
                    <input
                      type="text"
                      value={q.text}
                      onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                      placeholder={
                        q.type === "date_select"
                          ? "When are you planning to camp?"
                          : q.type === "pax_select"
                          ? "How many persons?"
                          : "Enter your question..."
                      }
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-[#062c24] outline-none focus:border-emerald-400"
                    />
                  </div>

                  {/* System type info */}
                  {isSystem && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[10px] text-blue-600 font-semibold">
                      <i className="fas fa-info-circle mr-1" />
                      {q.type === "date_select"
                        ? "This shows a date picker. The selected dates are pre-filled in the shop automatically."
                        : "This shows a +/− group size stepper. The shop displays a pax badge on tents."}
                    </div>
                  )}

                  {/* Answer options (non-system types) */}
                  {!isSystem && (
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block">
                        Answer Options
                      </label>
                      <div className="space-y-2">
                        {options.map((o) => {
                          const rule = getRule(config.rules, q.id, o.id);
                          const isOptionExpanded = expandedO === `${q.id}:${o.id}`;
                          const isReadOnly = q.type === "yes_no";

                          return (
                            <div
                              key={o.id}
                              className="border border-slate-200 rounded-xl overflow-hidden"
                            >
                              <div className="flex items-center gap-2 p-2.5">
                                {!isReadOnly && (
                                  <input
                                    type="text"
                                    value={o.label}
                                    onChange={(e) =>
                                      updateOptionLabel(q.id, o.id, e.target.value)
                                    }
                                    placeholder="Option label..."
                                    className="flex-1 text-[10px] font-semibold text-[#062c24] outline-none"
                                  />
                                )}
                                {isReadOnly && (
                                  <span className="flex-1 text-[10px] font-semibold text-[#062c24]">
                                    {o.label}
                                  </span>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() =>
                                      setExpandedO(
                                        isOptionExpanded ? null : `${q.id}:${o.id}`
                                      )
                                    }
                                    className="text-[9px] font-black text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded-lg bg-emerald-50"
                                  >
                                    {(rule?.suggestedItemIds.length || 0) +
                                      (rule?.addonItemIds.length || 0)}{" "}
                                    items
                                  </button>
                                  {!isReadOnly && (
                                    <button
                                      onClick={() => removeOption(q.id, o.id)}
                                      className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-400"
                                    >
                                      <i className="fas fa-times text-[8px]" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Rule mapper */}
                              {isOptionExpanded && (
                                <div className="border-t border-slate-100 p-3 space-y-3 bg-slate-50">
                                  <GearPicker
                                    label="Recommended Items"
                                    gearList={gearList}
                                    selected={rule?.suggestedItemIds || []}
                                    onChange={(ids) =>
                                      setRuleItems(q.id, o.id, "suggestedItemIds", ids)
                                    }
                                  />
                                  <GearPicker
                                    label="Add-on Suggestions"
                                    gearList={gearList}
                                    selected={rule?.addonItemIds || []}
                                    onChange={(ids) =>
                                      setRuleItems(q.id, o.id, "addonItemIds", ids)
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {q.type !== "yes_no" && (
                        <button
                          onClick={() => addOption(q.id)}
                          className="mt-2 text-[9px] font-black text-emerald-600 hover:text-emerald-800 uppercase flex items-center gap-1"
                        >
                          <i className="fas fa-plus text-[8px]" /> Add Option
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={addQuestion}
          className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
        >
          <i className="fas fa-plus" /> Add Question
        </button>
      </div>
    </div>
  );
}
