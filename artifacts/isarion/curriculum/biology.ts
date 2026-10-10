import { skill } from "./skill";
import type { Curriculum } from "./types";

const CELLS = "Cells and Molecules";
const GEN = "Genetics and Evolution";
const ORGS = "Organisms";
const ECO = "Ecology";
const METHOD = "Experimental Biology";

/** School biology, roughly Grades 9–12. Each skill carries one placement probe. */
export const BIOLOGY_CURRICULUM: Curriculum = {
  subject: "Biology",
  units: [METHOD, CELLS, GEN, ORGS, ECO],
  skills: [
    skill("experimental_design", METHOD, "Experimental design",
      "Identify variables, controls and fair tests, and judge whether data support a claim.", [], 25,
      ["In an experiment, the variable deliberately changed by the investigator is the…", ["dependent variable", "independent variable", "control variable", "confounding variable"], 1, "The independent variable is the one you set."]),
    skill("cell_structure", CELLS, "Cell structure",
      "Relate organelles to their functions in prokaryotic and eukaryotic cells.", [], 30,
      ["Which organelle is the main site of aerobic respiration?", ["Ribosome", "Mitochondrion", "Golgi apparatus", "Nucleus"], 1, "Mitochondria carry out the Krebs cycle and oxidative phosphorylation."]),
    skill("biomolecules", CELLS, "Biological molecules",
      "Describe carbohydrates, lipids, proteins and nucleic acids and their monomers.", [], 30,
      ["Proteins are polymers of…", ["glucose", "fatty acids", "amino acids", "nucleotides"], 2, "Amino acids join by peptide bonds."]),
    skill("enzymes", CELLS, "Enzymes",
      "Explain how enzymes lower activation energy and why conditions affect their rate.", ["biomolecules", "experimental_design"], 35,
      ["Enzymes speed up reactions by…", ["raising the temperature", "lowering the activation energy", "adding energy to products", "being used up"], 1, "They provide an alternative pathway with lower activation energy."]),
    skill("membrane_transport", CELLS, "Membrane transport",
      "Explain diffusion, osmosis and active transport across membranes.", ["cell_structure", "biomolecules"], 30,
      ["Active transport differs from diffusion because it…", ["needs ATP", "moves water only", "is always faster", "needs no proteins"], 0, "Active transport moves substances against a gradient using energy from ATP."]),
    skill("cell_division", CELLS, "Mitosis and meiosis",
      "Compare mitosis and meiosis and their roles in growth and reproduction.", ["cell_structure"], 35,
      ["Meiosis produces cells that are…", ["diploid and identical", "haploid and genetically varied", "diploid and varied", "haploid and identical"], 1, "Meiosis halves the chromosome number and shuffles alleles."]),
    skill("mendelian_genetics", GEN, "Mendelian inheritance",
      "Predict offspring ratios with Punnett squares and explain dominance.", ["cell_division"], 35,
      ["Crossing two Aa parents gives what fraction aa?", ["0", "1/4", "1/2", "3/4"], 1, "The Punnett square gives AA : Aa : aa = 1 : 2 : 1."]),
    skill("molecular_genetics", GEN, "DNA, genes and protein synthesis",
      "Explain how DNA sequence is transcribed and translated into protein.", ["biomolecules", "cell_division"], 40,
      ["Translation takes place at the…", ["nucleus", "ribosome", "mitochondrion", "cell membrane"], 1, "Ribosomes read mRNA codons and join amino acids."]),
    skill("evolution", GEN, "Natural selection and evolution",
      "Explain how variation, inheritance and selection change populations.", ["mendelian_genetics"], 35,
      ["Natural selection acts directly on…", ["genes in isolation", "an individual's phenotype", "acquired characteristics", "the whole species at once"], 1, "Selection acts on traits that affect survival and reproduction."]),
    skill("photosynthesis_respiration", ORGS, "Photosynthesis and respiration",
      "Trace energy and matter through photosynthesis and cellular respiration.", ["enzymes", "cell_structure"], 40,
      ["The oxygen released in photosynthesis comes from…", ["carbon dioxide", "glucose", "water", "chlorophyll"], 2, "Water is split in the light-dependent reactions."]),
    skill("human_physiology", ORGS, "Human organ systems",
      "Explain how circulatory, respiratory and digestive systems exchange materials.", ["membrane_transport"], 40,
      ["Gas exchange in the lungs happens in the…", ["trachea", "bronchi", "alveoli", "diaphragm"], 2, "Alveoli have a thin, large surface next to capillaries."]),
    skill("homeostasis", ORGS, "Homeostasis",
      "Explain negative feedback in temperature and blood-glucose control.", ["human_physiology", "enzymes"], 35,
      ["After a meal, blood glucose rises. The pancreas releases…", ["glucagon", "insulin", "adrenaline", "thyroxine"], 1, "Insulin stimulates uptake of glucose, lowering blood glucose."]),
    skill("reproduction", ORGS, "Reproduction",
      "Compare sexual and asexual reproduction in plants and animals.", ["cell_division"], 30,
      ["Asexual reproduction produces offspring that are…", ["genetically identical to the parent", "always haploid", "more varied", "from two parents"], 0, "Asexual reproduction uses mitosis, so offspring are clones."]),
    skill("ecology", ECO, "Ecosystems and energy flow",
      "Trace energy through food webs and explain population interactions.", ["photosynthesis_respiration", "evolution"], 35,
      ["Roughly what share of energy passes from one trophic level to the next?", ["About 10%", "About 50%", "About 90%", "100%"], 0, "Most energy is lost as heat in respiration; about 10% is transferred."]),
  ],
  goals: [
    { id: "cell_bio", title: "Cell biology", blurb: "Cells, molecules, enzymes and transport.", targets: ["enzymes", "membrane_transport", "photosynthesis_respiration"] },
    { id: "genetics", title: "Genetics and evolution", blurb: "Inheritance, DNA and natural selection.", targets: ["molecular_genetics", "evolution"] },
  ],
};
