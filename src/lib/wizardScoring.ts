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
  tentsNeeded: number;       // >1 when pax exceeds single-tent capacity
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
      if (itemScores[item.id] === undefined) continue;
      const maxPax = item.specs?.maxPax ?? 0;
      if (maxPax <= 0) continue;
      if (maxPax >= pax) {
        // Single tent fits — full boost
        itemScores[item.id] += 1.5;
      } else {
        // Pax exceeds this tent's capacity — proportional boost so larger
        // tents rank higher (fewer of them needed to cover the group)
        itemScores[item.id] += 1.5 * (maxPax / pax);
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
  // Items need ≥85% of top score AND at least 2.5 (= 1 rule + pax boost).
  const threshold = Math.max(2.5, maxScore * 0.85);
  const strongMatchIds = scoredEntries
    .filter(([, s]) => s >= threshold)
    .map(([id]) => id);

  // How many tents the group needs — based on the best tent's maxPax
  let tentsNeeded = 1;
  if (answers.pax != null && answers.pax > 1) {
    const pax = answers.pax;
    const bestMaxPax = rankedItemIds.reduce((best, id) => {
      const mp = gear.find(g => g.id === id)?.specs?.maxPax ?? 0;
      return Math.max(best, mp);
    }, 0);
    if (bestMaxPax > 0 && pax > bestMaxPax) {
      tentsNeeded = Math.ceil(pax / bestMaxPax);
    }
  }

  const recSet = new Set(rankedItemIds);
  const addonItemIds = [...addonSet].filter((id) => !recSet.has(id));

  return { rankedItemIds, strongMatchIds, addonItemIds, tentsNeeded };
}
