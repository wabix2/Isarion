import type { Curriculum, Skill } from "./types";

/**
 * Maths from arithmetic to calculus and beyond: 51 skills.
 *
 * Skill ids for factoring, quadratic_equations, functions and derivatives match
 * the concept ids already used by the API's PREREQUISITE_GRAPH, so the tutor
 * and the roadmap speak the same language.
 *
 * Lesson content (explanations, worked examples, practice sets) is NOT here
 * yet; this file is the map. Each skill carries one placement question.
 */

type Q = [question: string, options: [string, string, string, string], answer: 0 | 1 | 2 | 3, why: string];

function skill(
  id: string,
  unit: string,
  title: string,
  blurb: string,
  prereqs: string[],
  minutes: number,
  probe: Q,
): Skill {
  const [question, options, answer, why] = probe;
  return { id, unit, title, blurb, prereqs, minutes, probe: { question, options, answer, why } };
}

const ARITH = "Arithmetic";
const PREALG = "Pre-Algebra";
const ALG = "Algebra";
const GEO = "Geometry";
const TRIG = "Trigonometry";
const PRECALC = "Precalculus";
const CALC1 = "Calculus I";
const CALC2 = "Calculus II";
const BEYOND = "Beyond Calculus";

export const MATH_CURRICULUM: Curriculum = {
  subject: "Math",
  units: [ARITH, PREALG, ALG, GEO, TRIG, PRECALC, CALC1, CALC2, BEYOND],
  skills: [
    // ---------------------------------------------------------------- Arithmetic
    skill("whole_number_ops", ARITH, "Whole-number operations",
      "Add, subtract, multiply and divide whole numbers with confidence.", [], 20,
      ["What is 7 × 8 + 6?", ["56", "62", "64", "68"], 1, "7 × 8 = 56, then 56 + 6 = 62."]),
    skill("fractions_basics", ARITH, "Understanding fractions",
      "See what a fraction means and spot when two fractions are equal.", ["whole_number_ops"], 25,
      ["Which fraction equals 2/4?", ["1/4", "1/2", "2/8", "4/2"], 1, "Divide top and bottom by 2: 2/4 = 1/2."]),
    skill("fraction_operations", ARITH, "Fraction operations",
      "Add, subtract, multiply and divide fractions.", ["fractions_basics"], 30,
      ["What is 1/2 + 1/3?", ["2/5", "1/6", "5/6", "2/6"], 2, "Use a common denominator: 3/6 + 2/6 = 5/6."]),
    skill("decimals_percent", ARITH, "Decimals and percentages",
      "Move between fractions, decimals and percent.", ["fractions_basics"], 25,
      ["What is 25% of 80?", ["15", "20", "25", "32"], 1, "25% is 1/4, and 80 ÷ 4 = 20."]),
    skill("ratios_proportions", ARITH, "Ratios and proportions",
      "Compare quantities and scale them up or down.", ["fraction_operations", "decimals_percent"], 30,
      ["3 notebooks cost 12 birr. How much do 5 notebooks cost at the same price?", ["15 birr", "18 birr", "20 birr", "24 birr"], 2,
        "One notebook is 4 birr, so 5 cost 20 birr."]),

    // ---------------------------------------------------------------- Pre-Algebra
    skill("negative_numbers", PREALG, "Negative numbers",
      "Work with numbers below zero.", ["whole_number_ops"], 25,
      ["What is −3 − 5?", ["−2", "2", "−8", "8"], 2, "Going 5 more to the left of −3 lands on −8."]),
    skill("order_of_operations", PREALG, "Order of operations",
      "Know which part of an expression to calculate first.", ["whole_number_ops"], 20,
      ["What is 6 + 2 × 3²?", ["24", "54", "72", "144"], 0, "Exponent first: 3² = 9. Then 2 × 9 = 18. Then 6 + 18 = 24."]),
    skill("exponents_roots", PREALG, "Exponents and square roots",
      "Understand repeated multiplication and its reverse.", ["order_of_operations"], 25,
      ["What is √49 + 2³?", ["13", "15", "17", "22"], 1, "√49 = 7 and 2³ = 8, so the answer is 15."]),

    // ---------------------------------------------------------------- Algebra
    skill("algebraic_expressions", ALG, "Algebraic expressions",
      "Use letters for unknown numbers and combine like terms.", ["negative_numbers", "order_of_operations"], 30,
      ["Simplify 3x + 2x − x.", ["4x", "5x", "6x", "4"], 0, "3 + 2 − 1 = 4, so the answer is 4x."]),
    skill("linear_equations", ALG, "Solving linear equations",
      "Find the unknown by undoing operations step by step.", ["algebraic_expressions", "fraction_operations"], 35,
      ["Solve 2x + 5 = 17.", ["x = 4", "x = 6", "x = 11", "x = 12"], 1, "Subtract 5 to get 2x = 12, then divide by 2: x = 6."]),
    skill("inequalities", ALG, "Inequalities",
      "Solve statements with \"less than\" and \"greater than\".", ["linear_equations"], 25,
      ["Solve −2x < 6.", ["x < −3", "x > −3", "x < 3", "x > 3"], 1, "Divide by −2 and flip the sign: x > −3."]),
    skill("graphing_lines", ALG, "Graphing lines and slope",
      "Read and draw straight lines on a graph.", ["linear_equations", "ratios_proportions"], 30,
      ["What is the slope of the line through (0, 1) and (2, 5)?", ["1/2", "1", "2", "4"], 2, "Rise 4 over run 2 gives slope 2."]),
    skill("systems_equations", ALG, "Systems of equations",
      "Solve two equations with two unknowns at the same time.", ["linear_equations", "graphing_lines"], 35,
      ["If x + y = 5 and x − y = 1, what is x?", ["1", "2", "3", "4"], 2, "Add the equations: 2x = 6, so x = 3."]),
    skill("exponent_laws", ALG, "Laws of exponents",
      "Use the rules for multiplying, dividing and raising powers.", ["exponents_roots", "algebraic_expressions"], 25,
      ["Simplify x⁵ ÷ x².", ["x³", "x⁷", "x^(5/2)", "x¹⁰"], 0, "When dividing powers, subtract the exponents: 5 − 2 = 3."]),
    skill("polynomials", ALG, "Polynomials",
      "Add, subtract and multiply expressions that contain powers of x.", ["algebraic_expressions", "exponent_laws"], 35,
      ["Expand (x + 2)(x + 3).", ["x² + 6", "x² + 5x + 6", "x² + 5x + 5", "2x + 5"], 1, "x·x + 3x + 2x + 6 = x² + 5x + 6."]),
    skill("factoring", ALG, "Factoring",
      "Break an expression into a product of simpler parts.", ["polynomials"], 35,
      ["Factor x² + 7x + 12.", ["(x + 2)(x + 6)", "(x + 3)(x + 4)", "(x + 1)(x + 12)", "(x − 3)(x − 4)"], 1,
        "3 × 4 = 12 and 3 + 4 = 7."]),
    skill("quadratic_equations", ALG, "Quadratic equations",
      "Solve equations with x² by factoring and with the quadratic formula.", ["factoring"], 40,
      ["Solve x² − 5x + 6 = 0.", ["x = 1 or x = 6", "x = 2 or x = 3", "x = −2 or x = −3", "x = −1 or x = −6"], 1,
        "It factors as (x − 2)(x − 3) = 0, so x = 2 or x = 3."]),
    skill("functions", ALG, "Functions",
      "Understand inputs, outputs and the notation f(x).", ["linear_equations", "graphing_lines"], 35,
      ["If f(x) = 2x² − 1, what is f(3)?", ["5", "11", "17", "35"], 2, "2 · 9 − 1 = 17."]),

    // ---------------------------------------------------------------- Geometry
    skill("perimeter_area", GEO, "Perimeter and area",
      "Measure the edge and the space inside shapes.", ["whole_number_ops", "decimals_percent", "fraction_operations"], 30,
      ["What is the area of a triangle with base 10 and height 6?", ["16", "30", "32", "60"], 1, "Area = ½ × 10 × 6 = 30."]),
    skill("angles_triangles", GEO, "Angles and triangles",
      "Use angle rules, including why triangle angles add up to 180°.", ["whole_number_ops"], 25,
      ["Two angles of a triangle are 50° and 60°. What is the third?", ["60°", "70°", "80°", "110°"], 1, "180 − 50 − 60 = 70."]),
    skill("pythagorean_theorem", GEO, "The Pythagorean theorem",
      "Find a missing side of a right triangle.", ["exponents_roots", "angles_triangles"], 30,
      ["A right triangle has legs 3 and 4. How long is the hypotenuse?", ["5", "6", "7", "25"], 0, "√(9 + 16) = √25 = 5."]),
    skill("similarity_scaling", GEO, "Similar shapes and scaling",
      "Use scale factors to find unknown lengths.", ["ratios_proportions", "angles_triangles"], 30,
      ["Two triangles are similar. A side of 3 in the first matches a side of 6 in the second. What does a side of 5 in the first match?",
        ["8", "10", "11", "15"], 1, "The scale factor is 2, so 5 × 2 = 10."]),
    skill("circles", GEO, "Circles",
      "Find the circumference and area of circles.", ["perimeter_area", "exponents_roots"], 30,
      ["What is the area of a circle with radius 3?", ["3π", "6π", "9π", "18π"], 2, "Area = πr² = π · 9 = 9π."]),

    // ---------------------------------------------------------------- Trigonometry
    skill("right_triangle_trig", TRIG, "Right-triangle trigonometry",
      "Use sine, cosine and tangent to find sides and angles.", ["pythagorean_theorem", "similarity_scaling"], 35,
      ["In a right triangle, sin θ equals…", ["adjacent / hypotenuse", "opposite / hypotenuse", "opposite / adjacent", "hypotenuse / opposite"], 1,
        "Sine = Opposite / Hypotenuse."]),
    skill("unit_circle_radians", TRIG, "The unit circle and radians",
      "Measure angles in radians and read values off the unit circle.", ["right_triangle_trig", "circles"], 40,
      ["π radians equals how many degrees?", ["90°", "180°", "270°", "360°"], 1, "Half a turn is π radians, which is 180°."]),
    skill("trig_functions_graphs", TRIG, "Graphs of trig functions",
      "Sketch sine, cosine and tangent and read their period.", ["unit_circle_radians", "functions"], 40,
      ["What is the period of y = sin x?", ["π", "2π", "π/2", "4π"], 1, "The sine wave repeats every 2π."]),
    skill("trig_identities", TRIG, "Trig identities",
      "Use identities like sin²θ + cos²θ = 1 to simplify and solve.", ["unit_circle_radians", "polynomials"], 40,
      ["If sin θ = 3/5 and θ is acute, what is cos θ?", ["3/4", "4/5", "5/4", "2/5"], 1,
        "sin²θ + cos²θ = 1 gives cos²θ = 16/25, so cos θ = 4/5."]),

    // ---------------------------------------------------------------- Precalculus
    skill("exponential_functions", PRECALC, "Exponential functions",
      "Model growth and decay that multiply by a fixed factor.", ["functions", "exponent_laws"], 35,
      ["A population of 100 doubles every year. How many after 3 years?", ["300", "600", "800", "1000"], 2, "100 × 2³ = 800."]),
    skill("logarithms", PRECALC, "Logarithms",
      "Use logarithms to undo exponents.", ["exponential_functions"], 35,
      ["What is log₂ 32?", ["4", "5", "16", "64"], 1, "2⁵ = 32, so log₂ 32 = 5."]),
    skill("polynomial_rational_functions", PRECALC, "Polynomial and rational functions",
      "Understand the shape of these functions and where they break.", ["quadratic_equations", "functions"], 40,
      ["Where is f(x) = 1/(x − 2) undefined?", ["x = 0", "x = −2", "x = 2", "Nowhere"], 2, "The denominator is zero when x = 2."]),
    skill("function_composition", PRECALC, "Composition and inverses",
      "Combine functions and undo them.", ["functions"], 30,
      ["If f(x) = x + 1 and g(x) = 2x, what is f(g(3))?", ["6", "7", "8", "12"], 1, "g(3) = 6, then f(6) = 7."]),
    skill("sequences_sums", PRECALC, "Sequences and sums",
      "Find patterns in lists of numbers and add them up.", ["functions", "exponent_laws"], 30,
      ["What is 1 + 2 + 3 + … + 10?", ["45", "55", "100", "110"], 1, "n(n + 1)/2 = 10 · 11 / 2 = 55."]),

    // ---------------------------------------------------------------- Calculus I
    skill("limits_intro", CALC1, "Limits",
      "Describe what a function approaches as x gets close to a value.",
      ["functions", "polynomial_rational_functions", "factoring"], 45,
      ["What is the limit of (x² − 4)/(x − 2) as x → 2?", ["0", "2", "4", "Does not exist"], 2,
        "Factor: (x − 2)(x + 2)/(x − 2) = x + 2, which approaches 4."]),
    skill("continuity", CALC1, "Continuity",
      "Tell whether a function has breaks, jumps or holes.", ["limits_intro"], 30,
      ["Which function has a break at x = 0?", ["x²", "1/x", "3x + 1", "|x|"], 1, "1/x is undefined at 0 and blows up near it."]),
    skill("derivatives", CALC1, "What a derivative is",
      "Understand the derivative as slope and rate of change.", ["limits_intro", "graphing_lines"], 40,
      ["The derivative of a function at a point gives…",
        ["the area under the curve", "the slope of the tangent line there", "the function's maximum value", "the average of the function"], 1,
        "It is the instantaneous rate of change, the slope of the tangent line."]),
    skill("derivative_rules", CALC1, "Power and sum rules",
      "Differentiate polynomials quickly.", ["derivatives"], 35,
      ["What is d/dx of 5x³?", ["5x²", "15x²", "15x³", "3x²"], 1, "Bring down the 3, multiply by 5, lower the power: 15x²."]),
    skill("product_quotient_rules", CALC1, "Product and quotient rules",
      "Differentiate products and ratios of functions.", ["derivative_rules"], 40,
      ["Using the product rule, what is d/dx of x²(x + 1)?", ["2x", "3x² + 1", "3x² + 2x", "x³ + x²"], 2,
        "2x(x + 1) + x² · 1 = 3x² + 2x."]),
    skill("chain_rule", CALC1, "The chain rule",
      "Differentiate functions inside other functions.", ["derivative_rules", "function_composition"], 40,
      ["What is d/dx of (2x + 1)³?", ["3(2x + 1)²", "6(2x + 1)²", "6x + 3", "2(2x + 1)³"], 1,
        "Outer: 3(2x + 1)². Inner: times 2. Result: 6(2x + 1)²."]),
    skill("transcendental_derivatives", CALC1, "Derivatives of sin, cos, eˣ and ln x",
      "Differentiate trig, exponential and log functions.", ["chain_rule", "trig_functions_graphs", "logarithms"], 40,
      ["What is d/dx of sin x?", ["−sin x", "cos x", "−cos x", "tan x"], 1, "The slope of sin x at each point is cos x."]),
    skill("curve_sketching_optimization", CALC1, "Maxima, minima and optimization",
      "Use derivatives to find the best value and sketch curves.", ["derivative_rules", "quadratic_equations"], 45,
      ["At a local maximum of a smooth function, the derivative…",
        ["is always positive", "is zero and changes from positive to negative", "is undefined", "is at its largest"], 1,
        "The function rises, then falls, so the slope goes from + to 0 to −."]),

    // ---------------------------------------------------------------- Calculus II
    skill("antiderivatives", CALC2, "Antiderivatives",
      "Reverse differentiation to find a function from its slope.", ["derivative_rules"], 35,
      ["What is ∫ 6x² dx?", ["12x + C", "2x³ + C", "3x³ + C", "6x³ + C"], 1, "Raise the power to 3 and divide by 3: 2x³ + C."]),
    skill("definite_integrals_ftc", CALC2, "Definite integrals and the Fundamental Theorem",
      "Compute exact areas using antiderivatives.", ["antiderivatives", "sequences_sums"], 45,
      ["What is ∫ from 0 to 2 of 3x² dx?", ["4", "6", "8", "12"], 2, "An antiderivative is x³, so 2³ − 0³ = 8."]),
    skill("integral_applications", CALC2, "Area and volume with integrals",
      "Use integrals to measure areas between curves and volumes of solids.", ["definite_integrals_ftc", "circles"], 45,
      ["What is the area under y = x from x = 0 to x = 4?", ["2", "4", "8", "16"], 2, "∫ x dx = x²/2, so 16/2 − 0 = 8."]),
    skill("integration_techniques", CALC2, "Substitution and integration by parts",
      "Handle harder integrals with standard techniques.", ["definite_integrals_ftc", "chain_rule"], 50,
      ["What is ∫ 2x(x² + 1)³ dx?", ["(x² + 1)⁴/4 + C", "(x² + 1)⁴ + C", "(x² + 1)³/3 + C", "2x(x² + 1)⁴/4 + C"], 0,
        "Let u = x² + 1, so du = 2x dx. Then ∫ u³ du = u⁴/4."]),
    skill("infinite_series", CALC2, "Infinite series",
      "Decide whether an endless sum settles on a value.", ["limits_intro", "sequences_sums"], 45,
      ["What does 1 + 1/2 + 1/4 + 1/8 + … add up to?", ["It diverges", "1", "2", "4"], 2, "Geometric series: 1 / (1 − 1/2) = 2."]),
    skill("taylor_series", CALC2, "Taylor series",
      "Write functions as endless polynomials.", ["infinite_series", "transcendental_derivatives"], 50,
      ["Which series starts the expansion of eˣ around 0?",
        ["1 + x + x²/2 + …", "1 + x² + x⁴ + …", "x + x² + x³ + …", "1 − x + x²/2 − …"], 0,
        "Every derivative of eˣ equals 1 at 0, so the coefficients are 1/n!."]),

    // ---------------------------------------------------------------- Beyond Calculus
    skill("vectors_basics", BEYOND, "Vectors",
      "Add vectors and use the dot product.", ["right_triangle_trig", "systems_equations"], 35,
      ["What is the dot product of (1, 2) and (3, 4)?", ["7", "10", "11", "14"], 2, "1·3 + 2·4 = 11."]),
    skill("matrices_linear_systems", BEYOND, "Matrices and linear systems",
      "Multiply matrices and solve systems with them.", ["systems_equations", "vectors_basics"], 45,
      ["What is the matrix [[1, 2], [3, 4]] times the column vector (1, 0)?", ["(1, 2)", "(2, 4)", "(1, 3)", "(3, 4)"], 2,
        "Multiplying by (1, 0) picks out the first column: (1, 3)."]),
    skill("linear_algebra_core", BEYOND, "Eigenvalues and vector spaces",
      "Understand the core ideas behind linear algebra.", ["matrices_linear_systems"], 50,
      ["If Av = 3v for a nonzero vector v, then 3 is called an…", ["determinant", "eigenvalue", "inverse", "rank"], 1,
        "A only stretches v by a factor of 3. That is the definition of an eigenvalue."]),
    skill("multivariable_calculus", BEYOND, "Multivariable calculus",
      "Differentiate and integrate functions of several variables.", ["chain_rule", "vectors_basics"], 50,
      ["What is the partial derivative of f(x, y) = x²y with respect to x?", ["x²", "2x", "2xy", "x²y"], 2,
        "Treat y as a constant: 2x · y = 2xy."]),
    skill("differential_equations", BEYOND, "Differential equations",
      "Solve equations that relate a function to its own derivative.", ["antiderivatives", "transcendental_derivatives"], 50,
      ["Which function satisfies y′ = y?", ["y = x", "y = x²", "y = eˣ", "y = ln x"], 2, "eˣ is its own derivative."]),
  ],
  goals: [
    {
      id: "foundations",
      title: "Solid foundations",
      blurb: "Numbers, fractions, percentages, negatives and order of operations.",
      targets: ["ratios_proportions", "negative_numbers", "exponents_roots"],
    },
    {
      id: "algebra",
      title: "Algebra",
      blurb: "Equations, inequalities, systems, factoring, quadratics and functions.",
      targets: ["quadratic_equations", "systems_equations", "inequalities", "functions"],
    },
    {
      id: "geometry_trig",
      title: "Geometry and trigonometry",
      blurb: "Shapes, circles, triangles and the unit circle.",
      targets: ["circles", "trig_identities"],
    },
    {
      id: "precalculus",
      title: "Ready for calculus",
      blurb: "Everything calculus assumes you already know.",
      targets: ["logarithms", "polynomial_rational_functions", "function_composition", "trig_functions_graphs"],
    },
    {
      id: "calculus_1",
      title: "Calculus I",
      blurb: "Limits, derivatives and optimization.",
      targets: ["curve_sketching_optimization", "transcendental_derivatives", "product_quotient_rules"],
    },
    {
      id: "calculus_2",
      title: "Calculus II",
      blurb: "Integrals, techniques and series.",
      targets: ["integration_techniques", "integral_applications", "taylor_series"],
    },
    {
      id: "beyond",
      title: "Beyond calculus",
      blurb: "Linear algebra, multivariable calculus and differential equations.",
      targets: ["differential_equations", "multivariable_calculus", "linear_algebra_core"],
    },
  ],
};
