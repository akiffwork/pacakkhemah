export type WizardAnswers = {
  dates?: { from: string; to: string };
  pax?: number;
  choices: Record<string, string[]>; // questionId → selected optionIds
};

export type WizardRule = {
  id: string;
  conditions: { questionId: string; optionId: string }[];
  suggestedItemIds: string[];
  addonItemIds: string[];
  excludePackages?: boolean; // when true, packages are removed from ALL scored items if this rule fires
};

export type ScoringGearItem = {
  id: string;
  type?: string;
  specs?: { maxPax?: number };
};

export type ScoringResult = {
  rankedItemIds: string[];   // all scored items, sorted — used for sorting & ring
  strongMatchIds: string[];  // only high-confidence matches — used for "For You" badge
  addonItemIds: string[];
};

export function scoreWizard(
  answers: WizardAnswers,
  rules: WizardRule[],
  gear: ScoringGearItem[]
): ScoringResult {
  const itemScores: Record<string, number> = {};
  const addonSet = new Set<string>();
  let excludePackages = false;

  for (const rule of rules) {
    const fired = rule.conditions.every((c) =>
      answers.choices[c.questionId]?.includes(c.optionId)
    );
    if (!fired) continue;
    if (rule.excludePackages) excludePackages = true;
    for (const id of rule.suggestedItemIds) {
      itemScores[id] = (itemScores[id] ?? 0) + 1;
    }
    for (const id of rule.addonItemIds) {
      addonSet.add(id);
    }
  }

  if (answers.pax != null) {
    const pax = answers.pax;
    for (const item of gear) {
      if (itemScores[item.id] !== undefined && (item.specs?.maxPax ?? 0) >= pax) {
        itemScores[item.id] += 1.5;
      }
    }
  }

  if (excludePackages) {
    const packageIds = new Set(gear.filter(g => g.type === "package").map(g => g.id));
    for (const id of packageIds) delete itemScores[id];
  }

  const scoredEntries = Object.entries(itemScores).filter(([, s]) => s > 0);
  const rankedItemIds = scoredEntries
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);

  const maxScore = scoredEntries.reduce((m, [, s]) => Math.max(m, s), 0);
  const threshold = Math.max(1.5, maxScore * 0.6);
  const strongMatchIds = scoredEntries
    .filter(([, s]) => s >= threshold)
    .map(([id]) => id);

  const recSet = new Set(rankedItemIds);
  const addonItemIds = [...addonSet].filter((id) => !recSet.has(id));

  return { rankedItemIds, strongMatchIds, addonItemIds };
}
