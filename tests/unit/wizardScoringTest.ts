import { scoreWizard } from "@/lib/wizardScoring";

const gear = [
  { id: "tent-a", specs: { maxPax: 6 } },
  { id: "tent-b", specs: { maxPax: 2 } },
  { id: "mat", specs: {} },
  { id: "stove" },
];

const rules = [
  {
    id: "r1",
    conditions: [{ questionId: "q1", optionId: "pahang" }],
    suggestedItemIds: ["tent-a", "mat"],
    addonItemIds: [],
  },
  {
    id: "r2",
    conditions: [{ questionId: "q2", optionId: "family" }],
    suggestedItemIds: ["tent-a"],
    addonItemIds: ["stove"],
  },
  {
    id: "r3",
    conditions: [{ questionId: "q1", optionId: "kl" }],
    suggestedItemIds: ["tent-b"],
    addonItemIds: [],
  },
];

describe("scoreWizard", () => {
  it("scores items by number of matched rules", () => {
    const { rankedItemIds } = scoreWizard(
      { choices: { q1: ["pahang"], q2: ["family"] } },
      rules,
      []
    );
    expect(rankedItemIds[0]).toBe("tent-a"); // score 2
    expect(rankedItemIds).toContain("mat");
    expect(rankedItemIds).not.toContain("tent-b");
  });

  it("does not include items from unmatched rules", () => {
    const { rankedItemIds } = scoreWizard(
      { choices: { q1: ["pahang"] } },
      rules,
      []
    );
    expect(rankedItemIds).not.toContain("tent-b");
  });

  it("applies pax boost only to tents with sufficient maxPax", () => {
    const { rankedItemIds } = scoreWizard(
      { choices: { q1: ["pahang"] }, pax: 4 },
      rules,
      gear
    );
    // tent-a: score 1 + pax boost 1.5 = 2.5; mat: score 1 + no boost = 1
    expect(rankedItemIds[0]).toBe("tent-a");
    expect(rankedItemIds[1]).toBe("mat");
  });

  it("does not boost a tent with insufficient maxPax", () => {
    // tent-b maxPax=2 < pax=4, so no boost; score stays at 1
    // tent-a is not suggested by rule r3, so it won't appear
    const { rankedItemIds } = scoreWizard(
      { choices: { q1: ["kl"] }, pax: 4 },
      rules,
      gear
    );
    expect(rankedItemIds).toContain("tent-b");
    expect(rankedItemIds).not.toContain("tent-a"); // not suggested by kl rule
    // tent-b should be the only item — score 1, no pax boost
    expect(rankedItemIds).toHaveLength(1);
  });

  it("collects addon ids from fired rules", () => {
    const { addonItemIds } = scoreWizard(
      { choices: { q2: ["family"] } },
      rules,
      []
    );
    expect(addonItemIds).toContain("stove");
  });

  it("excludes addons already in recommended list", () => {
    const r = [
      {
        id: "r",
        conditions: [{ questionId: "q1", optionId: "x" }],
        suggestedItemIds: ["stove"],
        addonItemIds: ["stove"],
      },
    ];
    const { rankedItemIds, addonItemIds } = scoreWizard(
      { choices: { q1: ["x"] } },
      r,
      []
    );
    expect(rankedItemIds).toContain("stove");
    expect(addonItemIds).not.toContain("stove");
  });

  it("returns empty lists when no rules match", () => {
    const { rankedItemIds, addonItemIds } = scoreWizard(
      { choices: { q1: ["unknown"] } },
      rules,
      []
    );
    expect(rankedItemIds).toHaveLength(0);
    expect(addonItemIds).toHaveLength(0);
  });

  it("handles multi-select answers", () => {
    const { rankedItemIds } = scoreWizard(
      { choices: { q1: ["pahang", "kl"] } },
      rules,
      []
    );
    expect(rankedItemIds).toContain("tent-a");
    expect(rankedItemIds).toContain("tent-b");
    expect(rankedItemIds).toContain("mat");
  });
});
