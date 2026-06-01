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
};

export type ScoringGearItem = {
  id: string;
  specs?: { maxPax?: number };
};

export type ScoringResult = {
  rankedItemIds: string[];
  addonItemIds: string[];
};

export function scoreWizard(
  answers: WizardAnswers,
  rules: WizardRule[],
  gear: ScoringGearItem[]
): ScoringResult {
  const itemScores: Record<string, number> = {};
  const addonSet = new Set<string>();

  for (const rule of rules) {
    const fired = rule.conditions.every((c) =>
      answers.choices[c.questionId]?.includes(c.optionId)
    );
    if (!fired) continue;
    for (const id of rule.suggestedItemIds) {
      itemScores[id] = (itemScores[id] ?? 0) + 1;
    }
    for (const id of rule.addonItemIds) {
      addonSet.add(id);
    }
  }

  if (answers.pax) {
    const pax = answers.pax;
    for (const item of gear) {
      if (itemScores[item.id] !== undefined && (item.specs?.maxPax ?? 0) >= pax) {
        itemScores[item.id] += 1.5;
      }
    }
  }

  const rankedItemIds = Object.entries(itemScores)
    .filter(([, s]) => s > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);

  const recSet = new Set(rankedItemIds);
  const addonItemIds = [...addonSet].filter((id) => !recSet.has(id));

  return { rankedItemIds, addonItemIds };
}
