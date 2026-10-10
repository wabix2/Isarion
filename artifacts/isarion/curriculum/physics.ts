import { skill } from "./skill";
import type { Curriculum } from "./types";

const FOUND = "Foundations";
const MECH = "Mechanics";
const WAVES = "Waves";
const EM = "Electricity and Magnetism";
const MODERN = "Modern Physics";

/** School physics, roughly Grades 9–12. Each skill carries one placement probe. */
export const PHYSICS_CURRICULUM: Curriculum = {
  subject: "Physics",
  units: [FOUND, MECH, WAVES, EM, MODERN],
  skills: [
    skill("units_measurement", FOUND, "Units and measurement",
      "Use SI units, prefixes and significant figures, and check equations by their units.", [], 25,
      ["How many metres are in 3.2 km?", ["32 m", "320 m", "3200 m", "0.0032 m"], 2, "kilo means 10³, so 3.2 km = 3.2 × 1000 m = 3200 m."]),
    skill("scalars_vectors", FOUND, "Scalars and vectors",
      "Tell magnitude-only quantities from directed ones and add vectors.", ["units_measurement"], 30,
      ["Which of these is a vector?", ["Mass", "Temperature", "Displacement", "Energy"], 2, "Displacement has both size and direction."]),
    skill("motion_1d", MECH, "Velocity and acceleration",
      "Describe straight-line motion with displacement, velocity and acceleration.", ["scalars_vectors"], 35,
      ["A car goes from 10 m/s to 30 m/s in 5 s. Its average acceleration is…", ["2 m/s²", "4 m/s²", "6 m/s²", "8 m/s²"], 1, "a = Δv/Δt = 20/5 = 4 m/s²."]),
    skill("kinematic_equations", MECH, "Constant-acceleration equations",
      "Predict position and velocity when acceleration is constant.", ["motion_1d"], 35,
      ["From rest, a = 2 m/s² for 3 s. How far does it travel?", ["3 m", "6 m", "9 m", "18 m"], 2, "s = ½at² = ½ · 2 · 9 = 9 m."]),
    skill("newtons_laws", MECH, "Newton's laws of motion",
      "Relate net force, mass and acceleration and identify force pairs.", ["motion_1d"], 40,
      ["A 2 kg cart has a net force of 6 N on it. Its acceleration is…", ["0.33 m/s²", "3 m/s²", "8 m/s²", "12 m/s²"], 1, "a = F/m = 6/2 = 3 m/s²."]),
    skill("work_energy", MECH, "Work, energy and power",
      "Track energy transfers and use conservation of energy.", ["newtons_laws"], 40,
      ["A 2 kg ball moves at 3 m/s. Its kinetic energy is…", ["3 J", "6 J", "9 J", "18 J"], 2, "KE = ½mv² = ½ · 2 · 9 = 9 J."]),
    skill("momentum", MECH, "Momentum and collisions",
      "Use conservation of momentum to analyse collisions.", ["newtons_laws"], 35,
      ["What is the momentum of a 0.5 kg ball at 4 m/s?", ["0.125 kg·m/s", "2 kg·m/s", "4.5 kg·m/s", "8 kg·m/s"], 1, "p = mv = 0.5 · 4 = 2 kg·m/s."]),
    skill("gravitation", MECH, "Gravitation",
      "Apply Newton's law of gravitation and explain weight and orbits.", ["newtons_laws"], 35,
      ["If the distance between two masses doubles, the gravitational force becomes…", ["twice as large", "half as large", "a quarter as large", "unchanged"], 2, "F ∝ 1/r², so doubling r divides F by 4."]),
    skill("waves_basics", WAVES, "Wave properties",
      "Relate wavelength, frequency and speed, and distinguish wave types.", ["units_measurement"], 30,
      ["A wave has frequency 5 Hz and wavelength 2 m. Its speed is…", ["2.5 m/s", "7 m/s", "10 m/s", "0.4 m/s"], 2, "v = fλ = 5 · 2 = 10 m/s."]),
    skill("sound", WAVES, "Sound",
      "Explain sound as a longitudinal pressure wave and relate pitch and loudness to its properties.", ["waves_basics"], 25,
      ["Sound cannot travel through…", ["water", "steel", "air", "a vacuum"], 3, "Sound needs a medium to carry the pressure wave."]),
    skill("light_optics", WAVES, "Light and optics",
      "Use reflection and refraction to explain how mirrors and lenses form images.", ["waves_basics"], 35,
      ["When light enters glass from air, it…", ["speeds up", "slows down", "keeps the same speed", "stops"], 1, "Glass has a higher refractive index, so light slows down."]),
    skill("electric_circuits", EM, "Current, voltage and resistance",
      "Analyse simple circuits with Ohm's law and series/parallel rules.", ["units_measurement"], 40,
      ["A 12 V battery drives 2 A through a resistor. Its resistance is…", ["6 Ω", "10 Ω", "14 Ω", "24 Ω"], 0, "R = V/I = 12/2 = 6 Ω."]),
    skill("magnetism", EM, "Magnetism and induction",
      "Describe magnetic fields, forces on currents and electromagnetic induction.", ["electric_circuits", "scalars_vectors"], 35,
      ["A current is induced in a coil when…", ["a magnet rests inside it", "the magnetic field through it changes", "it is made of copper", "it is connected to a battery"], 1, "Induction needs a changing magnetic flux."]),
    skill("modern_physics", MODERN, "Photons and atoms",
      "Explain the photon model of light and atomic energy levels.", ["light_optics", "work_energy"], 35,
      ["Raising the frequency of light raises each photon's…", ["speed", "energy", "mass", "charge"], 1, "E = hf, so energy grows with frequency."]),
  ],
  goals: [
    { id: "mechanics", title: "Classical mechanics", blurb: "Motion, forces, energy and momentum.", targets: ["work_energy", "momentum", "gravitation"] },
    { id: "fields_waves", title: "Waves and fields", blurb: "Waves, light, circuits and magnetism.", targets: ["sound", "light_optics", "magnetism"] },
  ],
};
