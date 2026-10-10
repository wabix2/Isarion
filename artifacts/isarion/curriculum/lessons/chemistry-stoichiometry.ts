import type { Lesson } from "../lessonTypes";

/** Molar masses used throughout (g/mol): H 1.008, C 12.01, N 14.01, O 16.00, Na 22.99, Mg 24.31, Ca 40.08, Fe 55.85. */
export const CHEMISTRY_STOICHIOMETRY: Lesson = {
  schema: 1,
  id: "chemistry.stoichiometry",
  version: 1,
  subject: "Chemistry",
  skillId: "stoichiometry",
  title: "Stoichiometry: reacting masses and limiting reactants",
  minutes: 40,
  objectives: [
    "Interpret the coefficients of a balanced equation as mole ratios.",
    "Convert mass → moles → moles → mass for any reactant or product.",
    "Identify the limiting reactant and calculate the excess remaining.",
    "Calculate theoretical and percent yield, and explain why real yields are lower.",
  ],
  prerequisiteReview: [
    { skillId: "balancing_equations", text: "A balanced equation has the same number of each atom on both sides. Change coefficients, never subscripts: 2H₂ + O₂ → 2H₂O." },
    { skillId: "mole_concept", text: "n = m/M. Moles equal mass in grams divided by molar mass in g/mol. M(H₂O) = 2(1.008) + 16.00 = 18.02 g/mol." },
  ],
  concept: [
    { kind: "text", text: "A balanced equation is a recipe written in particles. Because one mole of anything contains the same number of particles (6.022 × 10²³), the coefficients are also ratios of moles." },
    { kind: "chem", text: "2H₂ + O₂ → 2H₂O", note: "2 mol H₂ react with 1 mol O₂ to give 2 mol H₂O" },
    { kind: "text", text: "Coefficients are NOT mass ratios. 2 mol H₂ is about 4 g, while 1 mol O₂ is about 32 g. Every stoichiometry problem therefore goes through moles." },
    { kind: "formula", text: "mass A  ─(÷ M_A)→  mol A  ─(× ratio)→  mol B  ─(× M_B)→  mass B" },
    { kind: "definition", term: "Limiting reactant", text: "The reactant that runs out first. It fixes how much product can form. The others are in excess." },
    { kind: "definition", term: "Theoretical yield", text: "The mass of product predicted from the limiting reactant, assuming complete reaction and no losses." },
    { kind: "definition", term: "Percent yield", text: "Actual yield ÷ theoretical yield × 100%. Usually below 100% because of incomplete reactions, side reactions and losses during transfer and purification." },
  ],
  formal: [
    { kind: "formula", text: "n = m / M", note: "n in mol, m in g, M in g/mol" },
    { kind: "formula", text: "n_B = n_A × (coefficient of B / coefficient of A)" },
    { kind: "formula", text: "percent yield = (actual / theoretical) × 100%" },
    { kind: "callout", tone: "caution", text: "To find the limiting reactant, compare moles available ÷ coefficient for each reactant. The smallest value is limiting. Comparing masses directly gives wrong answers." },
  ],
  workedExamples: [
    {
      id: "we1",
      title: "Mass of product from mass of reactant",
      problem: [{ kind: "text", text: "What mass of carbon dioxide forms when 16.0 g of methane burns completely?" }, { kind: "chem", text: "CH₄ + 2O₂ → CO₂ + 2H₂O" }],
      given: ["m(CH₄) = 16.0 g", "M(CH₄) = 12.01 + 4(1.008) = 16.04 g/mol", "M(CO₂) = 12.01 + 2(16.00) = 44.01 g/mol"],
      steps: [
        { text: "Moles of methane.", math: "n(CH₄) = 16.0 / 16.04 = 0.9975 mol" },
        { text: "Mole ratio CO₂ : CH₄ = 1 : 1.", math: "n(CO₂) = 0.9975 mol" },
        { text: "Convert to mass.", math: "m(CO₂) = 0.9975 × 44.01 = 43.9 g" },
      ],
      answer: "43.9 g of CO₂ (3 significant figures, matching 16.0 g).",
      check: "Mass ratio CO₂/CH₄ should be 44.01/16.04 ≈ 2.74; 16.0 × 2.74 ≈ 43.9.",
      verify: [{ expr: "16.0/16.04*44.01", equals: 43.9, tolerance: 0.001 }],
    },
    {
      id: "we2",
      title: "Limiting reactant and excess",
      problem: [{ kind: "text", text: "28.0 g of N₂ reacts with 9.00 g of H₂. Which is limiting, what mass of NH₃ can form, and how much H₂ is left over?" }, { kind: "chem", text: "N₂ + 3H₂ → 2NH₃" }],
      given: ["M(N₂) = 28.02 g/mol", "M(H₂) = 2.016 g/mol", "M(NH₃) = 14.01 + 3(1.008) = 17.03 g/mol"],
      steps: [
        { text: "Moles of each reactant.", math: "n(N₂) = 28.0 / 28.02 = 0.9993 mol;  n(H₂) = 9.00 / 2.016 = 4.464 mol" },
        { text: "Divide by coefficients to compare.", math: "N₂: 0.9993 / 1 = 0.9993;  H₂: 4.464 / 3 = 1.488" },
        { text: "N₂ gives the smaller value, so N₂ is limiting.", math: "H₂ needed = 3 × 0.9993 = 2.998 mol" },
        { text: "Product from the limiting reactant.", math: "n(NH₃) = 2 × 0.9993 = 1.999 mol;  m = 1.999 × 17.03 = 34.0 g" },
        { text: "Excess hydrogen remaining.", math: "4.464 − 2.998 = 1.466 mol = 1.466 × 2.016 = 2.96 g" },
      ],
      answer: "N₂ is limiting; 34.0 g NH₃ forms; about 2.96 g H₂ remains.",
      check: "Mass is conserved: 28.0 + 9.00 = 37.0 g in; 34.0 + 2.96 ≈ 37.0 g out.",
      verify: [
        { expr: "2*28.0/28.02*17.03", equals: 34.04, tolerance: 0.001 },
        { expr: "(9.00/2.016-3*28.0/28.02)*2.016", equals: 2.955, tolerance: 0.001 },
      ],
    },
  ],
  misconceptions: [
    { claim: "The reactant with the smaller mass is the limiting reactant.", correction: "Compare moles divided by coefficients. In example 2, H₂ has far less mass than N₂ but is in excess." },
    { claim: "Coefficients tell you the masses that react.", correction: "Coefficients are mole (particle) ratios. Convert to moles before using them." },
    { claim: "You can change subscripts to make an equation balance.", correction: "Changing a subscript changes the substance (H₂O vs H₂O₂). Only coefficients may change." },
    { claim: "A yield above 100% means the reaction worked especially well.", correction: "It signals an error: the product is likely wet or impure, or a mass was measured wrongly." },
  ],
  guided: [
    {
      id: "g1", type: "numeric", difficulty: 1, focus: "procedural", unit: "mol", gapSkill: "mole_concept",
      prompt: [{ kind: "text", text: "How many moles are in 36.0 g of water? Use M(H₂O) = 18.02 g/mol." }],
      hints: ["Use n = m/M.", "n = 36.0 / 18.02."],
      answer: 1.998, tolerance: 0.005, verify: { expr: "36.0/18.02", equals: 1.998, tolerance: 0.001 },
      explanation: "n = 36.0 g ÷ 18.02 g/mol = 2.00 mol (1.998 before rounding).",
    },
    {
      id: "g2", type: "numeric", difficulty: 1, focus: "conceptual", unit: "mol",
      prompt: [{ kind: "chem", text: "2H₂ + O₂ → 2H₂O" }, { kind: "text", text: "How many moles of O₂ react with 4.0 mol of H₂?" }],
      hints: ["Read the ratio O₂ : H₂ from the coefficients.", "It is 1 : 2.", "4.0 × 1/2."],
      answer: 2, tolerance: 0.001, verify: { expr: "4*1/2", equals: 2 },
      explanation: "O₂ : H₂ = 1 : 2, so 4.0 mol H₂ needs 2.0 mol O₂.",
    },
    {
      id: "g3", type: "numeric", difficulty: 2, focus: "procedural", unit: "g",
      prompt: [{ kind: "text", text: "Using the same equation, what mass of water forms from 4.0 mol of H₂? M(H₂O) = 18.02 g/mol." }],
      hints: ["H₂O : H₂ = 2 : 2.", "So 4.0 mol of water forms.", "Multiply by the molar mass."],
      answer: 72.08, tolerance: 0.005, verify: { expr: "4*18.02", equals: 72.08 },
      explanation: "n(H₂O) = 4.0 mol; m = 4.0 × 18.02 = 72 g.",
    },
  ],
  exercises: [
    { id: "e1", type: "numeric", difficulty: 1, focus: "procedural", unit: "mol", gapSkill: "mole_concept", prompt: [{ kind: "text", text: "How many moles are in 10.0 g of CaCO₃? M = 100.09 g/mol." }], hints: ["n = m/M."], answer: 0.09991, tolerance: 0.01, verify: { expr: "10/100.09", equals: 0.09991, tolerance: 0.001 }, explanation: "n = 10.0 / 100.09 = 0.0999 mol." },
    { id: "e2", type: "numeric", difficulty: 2, focus: "procedural", unit: "g", prompt: [{ kind: "chem", text: "2Mg + O₂ → 2MgO" }, { kind: "text", text: "What mass of MgO forms from 4.86 g Mg? M(Mg) = 24.31, M(MgO) = 40.31 g/mol." }], hints: ["MgO : Mg = 2 : 2."], answer: 8.059, tolerance: 0.01, verify: { expr: "4.86/24.31*40.31", equals: 8.059, tolerance: 0.001 }, explanation: "n(Mg) = 0.200 mol = n(MgO); m = 0.200 × 40.31 = 8.06 g." },
    { id: "e3", type: "numeric", difficulty: 2, focus: "procedural", unit: "g", prompt: [{ kind: "chem", text: "CaCO₃ → CaO + CO₂" }, { kind: "text", text: "What mass of CO₂ is released by heating 50.0 g of CaCO₃? M(CaCO₃) = 100.09, M(CO₂) = 44.01 g/mol." }], hints: ["The ratio is 1 : 1."], answer: 21.99, tolerance: 0.01, verify: { expr: "50/100.09*44.01", equals: 21.99, tolerance: 0.001 }, explanation: "n = 0.4996 mol; m(CO₂) = 0.4996 × 44.01 = 22.0 g." },
    { id: "e4", type: "mcq", difficulty: 2, focus: "conceptual", prompt: [{ kind: "chem", text: "2H₂ + O₂ → 2H₂O" }, { kind: "text", text: "3.0 mol H₂ is mixed with 2.0 mol O₂. Which is limiting?" }], options: ["H₂", "O₂", "Neither; they are in the exact ratio"], answer: 0, optionFeedback: [null, "O₂: 2.0/1 = 2.0, larger than H₂'s 3.0/2 = 1.5.", "The exact ratio would be 2 : 1."], hints: ["Divide each by its coefficient."], explanation: "H₂: 3.0/2 = 1.5; O₂: 2.0/1 = 2.0. H₂ is smaller, so it runs out first (only 1.5 mol O₂ is used)." },
    { id: "e5", type: "numeric", difficulty: 2, focus: "procedural", unit: "mol", prompt: [{ kind: "text", text: "In the previous question, how many moles of water form?" }], hints: ["Use the limiting reactant, H₂."], answer: 3, tolerance: 0.001, verify: { expr: "3*2/2", equals: 3 }, explanation: "H₂O : H₂ = 2 : 2, so 3.0 mol H₂O forms; 0.5 mol O₂ is left over." },
    { id: "e6", type: "numeric", difficulty: 2, focus: "procedural", unit: "%", prompt: [{ kind: "text", text: "The theoretical yield of MgO was 8.06 g but 7.25 g was collected. What is the percent yield?" }], hints: ["actual / theoretical × 100."], answer: 89.95, tolerance: 0.005, verify: { expr: "7.25/8.06*100", equals: 89.95, tolerance: 0.001 }, explanation: "7.25 / 8.06 × 100 = 90.0%." },
    { id: "e7", type: "mcq", difficulty: 1, focus: "conceptual", prompt: [{ kind: "text", text: "What does the 2 in front of H₂O in 2H₂ + O₂ → 2H₂O tell you?" }], options: ["Each water molecule has 2 oxygen atoms", "2 g of water form", "2 mol of water form for every 1 mol of O₂", "The reaction happens twice"], answer: 2, hints: ["Coefficients count particles or moles."], explanation: "Coefficients are mole ratios: 2 mol H₂O per 1 mol O₂ (and per 2 mol H₂)." },
  ],
  application: {
    title: "How much gas does an airbag need?",
    scenario: [
      { kind: "text", text: "Some airbag designs inflate using nitrogen from the rapid decomposition of sodium azide. Engineers must size the charge so the bag fills but does not over-pressurise." },
      { kind: "chem", text: "2NaN₃ → 2Na + 3N₂" },
      { kind: "text", text: "M(NaN₃) = 22.99 + 3(14.01) = 65.02 g/mol; M(N₂) = 28.02 g/mol." },
    ],
    questions: [
      { id: "ap1", type: "numeric", difficulty: 2, focus: "application", unit: "g", prompt: [{ kind: "text", text: "What mass of N₂ is produced from 130 g of NaN₃?" }], hints: ["N₂ : NaN₃ = 3 : 2.", "n(NaN₃) = 130 / 65.02."], answer: 84.03, tolerance: 0.01, verify: { expr: "130/65.02*3/2*28.02", equals: 84.03, tolerance: 0.001 }, explanation: "n(NaN₃) = 2.00 mol → n(N₂) = 3.00 mol → 3.00 × 28.02 = 84.0 g." },
      { id: "ap2", type: "short", difficulty: 2, focus: "application", prompt: [{ kind: "text", text: "Why must the engineers work in moles rather than simply \"twice the mass of azide\"?" }], hints: ["Gas volume depends on the number of molecules."], modelAnswer: "The volume of gas depends on the number of gas molecules (moles), not their mass. The equation gives a mole ratio of 3 N₂ per 2 NaN₃, and the substances have different molar masses, so a mass ratio cannot be read from the coefficients.", rubric: ["Gas amount/volume depends on moles", "Coefficients are mole ratios", "Different molar masses"], explanation: "Moles link the recipe to the physical amount of gas." },
    ],
  },
  assessment: [
    { id: "a1", type: "numeric", difficulty: 1, focus: "conceptual", unit: "mol", prompt: [{ kind: "chem", text: "CH₄ + 2O₂ → CO₂ + 2H₂O" }, { kind: "text", text: "How many moles of O₂ are needed to burn 2.5 mol of CH₄?" }], hints: [], answer: 5, tolerance: 0.001, verify: { expr: "2.5*2", equals: 5 }, explanation: "O₂ : CH₄ = 2 : 1, so 5.0 mol O₂." },
    { id: "a2", type: "numeric", difficulty: 2, focus: "procedural", unit: "g", prompt: [{ kind: "chem", text: "C₃H₈ + 5O₂ → 3CO₂ + 4H₂O" }, { kind: "text", text: "What mass of CO₂ forms from 22.0 g of propane? M(C₃H₈) = 44.09, M(CO₂) = 44.01 g/mol." }], hints: [], answer: 65.88, tolerance: 0.01, verify: { expr: "22/44.09*3*44.01", equals: 65.88, tolerance: 0.001 }, explanation: "n(C₃H₈) = 0.4990 mol → n(CO₂) = 1.497 mol → 65.9 g." },
    { id: "a3", type: "mcq", difficulty: 1, focus: "conceptual", prompt: [{ kind: "text", text: "Which statement about the limiting reactant is correct?" }], options: ["It is always the reactant with the smallest mass", "It determines the maximum amount of product", "It is left over at the end", "It always has the smallest coefficient"], answer: 1, hints: [], explanation: "The limiting reactant is used up first, so it fixes the theoretical yield." },
    { id: "a4", type: "numeric", difficulty: 3, focus: "application", unit: "g", prompt: [{ kind: "chem", text: "Fe₂O₃ + 3CO → 2Fe + 3CO₂" }, { kind: "text", text: "A blast furnace step uses 80.0 g of Fe₂O₃ with excess CO. What mass of iron forms? M(Fe₂O₃) = 159.70, M(Fe) = 55.85 g/mol." }], hints: [], answer: 55.95, tolerance: 0.01, verify: { expr: "80/159.7*2*55.85", equals: 55.95, tolerance: 0.001 }, explanation: "n(Fe₂O₃) = 0.5009 mol → n(Fe) = 1.002 mol → 56.0 g." },
    { id: "a5", type: "numeric", difficulty: 2, focus: "procedural", unit: "%", prompt: [{ kind: "text", text: "If 50.4 g of iron is recovered when 55.95 g was expected, what is the percent yield?" }], hints: [], answer: 90.08, tolerance: 0.005, verify: { expr: "50.4/55.95*100", equals: 90.08, tolerance: 0.001 }, explanation: "50.4 / 55.95 × 100 = 90.1%." },
  ],
  summary: {
    points: [
      "Coefficients in a balanced equation are mole ratios, not mass ratios.",
      "Route every problem: mass → moles → ratio → moles → mass.",
      "The limiting reactant has the smallest (moles ÷ coefficient) and sets the theoretical yield.",
      "Percent yield = actual ÷ theoretical × 100%; above 100% signals an error.",
    ],
    formulas: ["n = m/M", "n_B = n_A × (b/a)", "% yield = actual/theoretical × 100"],
  },
};
