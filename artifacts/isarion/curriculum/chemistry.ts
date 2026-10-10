import { skill } from "./skill";
import type { Curriculum } from "./types";

const ATOMS = "Atoms and the Periodic Table";
const BONDING = "Bonding and Formulas";
const REACT = "Reactions and Quantities";
const SYS = "Solutions and Systems";
const ORG = "Organic Chemistry";

/** School chemistry, roughly Grades 9–12. Each skill carries one placement probe. */
export const CHEMISTRY_CURRICULUM: Curriculum = {
  subject: "Chemistry",
  units: [ATOMS, BONDING, REACT, SYS, ORG],
  skills: [
    skill("atomic_structure", ATOMS, "Atomic structure",
      "Describe protons, neutrons and electrons and read atomic and mass numbers.", [], 25,
      ["An atom has atomic number 11. How many protons does it have?", ["1", "11", "12", "23"], 1, "The atomic number is the number of protons."]),
    skill("isotopes", ATOMS, "Isotopes and relative atomic mass",
      "Explain isotopes and compute a weighted average atomic mass.", ["atomic_structure"], 25,
      ["Carbon-12 and carbon-14 differ in their number of…", ["protons", "electrons", "neutrons", "nuclei"], 2, "Isotopes share a proton count but differ in neutrons."]),
    skill("electron_configuration", ATOMS, "Electron configuration",
      "Fill electron shells and subshells and link them to chemical behaviour.", ["atomic_structure"], 30,
      ["How many electrons are in the outer shell of sodium (Na, Z = 11)?", ["1", "2", "7", "8"], 0, "2, 8, 1 — one valence electron."]),
    skill("periodic_table", ATOMS, "Periodic trends",
      "Explain trends in atomic radius, ionisation energy and reactivity.", ["electron_configuration"], 30,
      ["Moving left to right across a period, atomic radius generally…", ["increases", "decreases", "stays the same", "doubles"], 1, "Nuclear charge rises while the shell stays the same, pulling electrons closer."]),
    skill("chemical_bonding", BONDING, "Chemical bonding",
      "Distinguish ionic, covalent and metallic bonding and predict properties.", ["periodic_table"], 35,
      ["Sodium chloride is held together by…", ["covalent bonds", "ionic bonds", "metallic bonds", "hydrogen bonds"], 1, "Na⁺ and Cl⁻ ions attract electrostatically."]),
    skill("formula_writing", BONDING, "Formulas and naming",
      "Write formulas from ion charges and name simple compounds.", ["chemical_bonding"], 30,
      ["The formula of calcium chloride (Ca²⁺, Cl⁻) is…", ["CaCl", "Ca₂Cl", "CaCl₂", "Ca₂Cl₃"], 2, "Two Cl⁻ balance one Ca²⁺."]),
    skill("balancing_equations", REACT, "Balancing chemical equations",
      "Balance equations so every element is conserved.", ["formula_writing"], 30,
      ["Balance: _H₂ + _O₂ → _H₂O", ["1, 1, 1", "2, 1, 2", "1, 2, 2", "2, 2, 1"], 1, "2H₂ + O₂ → 2H₂O has 4 H and 2 O on each side."]),
    skill("mole_concept", REACT, "The mole and molar mass",
      "Convert between mass, moles and number of particles.", ["isotopes", "formula_writing"], 35,
      ["How many moles are in 36 g of water (M = 18 g/mol)?", ["0.5 mol", "2 mol", "18 mol", "648 mol"], 1, "n = m/M = 36/18 = 2 mol."]),
    skill("stoichiometry", REACT, "Stoichiometry",
      "Use mole ratios from balanced equations to predict amounts.", ["balancing_equations", "mole_concept"], 40,
      ["In 2H₂ + O₂ → 2H₂O, 4 mol H₂ needs how much O₂?", ["1 mol", "2 mol", "4 mol", "8 mol"], 1, "The ratio H₂ : O₂ is 2 : 1."]),
    skill("reaction_types", REACT, "Types of reaction",
      "Classify synthesis, decomposition, displacement, combustion and redox reactions.", ["balancing_equations"], 30,
      ["CH₄ + 2O₂ → CO₂ + 2H₂O is an example of…", ["decomposition", "combustion", "neutralisation", "precipitation"], 1, "A fuel reacting with oxygen to give CO₂ and water is combustion."]),
    skill("gas_laws", SYS, "Gas laws",
      "Relate pressure, volume, temperature and amount of gas.", ["mole_concept"], 35,
      ["At constant temperature, halving a gas's volume makes its pressure…", ["halve", "double", "quadruple", "stay the same"], 1, "Boyle's law: pV is constant."]),
    skill("solutions", SYS, "Solutions and concentration",
      "Calculate concentration and perform dilutions.", ["mole_concept"], 30,
      ["0.5 mol of NaCl in 2.0 L of solution has concentration…", ["0.25 mol/L", "1 mol/L", "2.5 mol/L", "4 mol/L"], 0, "c = n/V = 0.5/2.0 = 0.25 mol/L."]),
    skill("acids_bases", SYS, "Acids, bases and pH",
      "Explain acid–base behaviour, neutralisation and the pH scale.", ["solutions", "reaction_types"], 35,
      ["A solution with pH 3 is…", ["strongly basic", "neutral", "acidic", "weakly basic"], 2, "pH below 7 is acidic."]),
    skill("equilibrium", SYS, "Chemical equilibrium",
      "Describe dynamic equilibrium and predict shifts with Le Chatelier's principle.", ["reaction_types", "solutions"], 35,
      ["Adding more reactant to a system at equilibrium shifts it…", ["toward reactants", "toward products", "nowhere", "to stop reacting"], 1, "The system shifts to consume the added reactant."]),
    skill("organic_intro", ORG, "Introduction to organic chemistry",
      "Name simple hydrocarbons and recognise functional groups.", ["chemical_bonding"], 35,
      ["The general formula for alkanes is…", ["CₙH₂ₙ", "CₙH₂ₙ₊₂", "CₙH₂ₙ₋₂", "CₙHₙ"], 1, "Alkanes are saturated: CₙH₂ₙ₊₂."]),
  ],
  goals: [
    { id: "quantitative", title: "Quantitative chemistry", blurb: "Moles, equations and stoichiometry.", targets: ["stoichiometry", "gas_laws"] },
    { id: "solution_chem", title: "Solution chemistry", blurb: "Concentration, acids and equilibrium.", targets: ["acids_bases", "equilibrium"] },
  ],
};
