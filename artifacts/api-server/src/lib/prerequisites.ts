import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { conceptPrerequisiteTable } from "@workspace/db/schema";

export type PrerequisiteEdge = {
  subject: string;
  conceptId: string;
  prerequisiteId: string;
  reason: string;
};

/**
 * A small, explicit graph is easier to review than hidden ML. The graph is
 * kept in one configuration module and can be migrated to the
 * concept_prerequisites table without changing recommendation code.
 */
export const PREREQUISITE_GRAPH: PrerequisiteEdge[] = [
  { subject: "Math", conceptId: "quadratic_equations", prerequisiteId: "factoring", reason: "Factoring is a prerequisite for solving many quadratics." },
  { subject: "Math", conceptId: "derivatives", prerequisiteId: "functions", reason: "Functions are the foundation for understanding derivatives." },
  { subject: "Biology", conceptId: "cell_division", prerequisiteId: "cell_structure", reason: "Cell structures must be understood before division." },
  { subject: "Biology", conceptId: "photosynthesis", prerequisiteId: "cell_structure", reason: "Chloroplast and cell structure knowledge supports photosynthesis." },
  { subject: "Chemistry", conceptId: "acid_base_reactions", prerequisiteId: "moles", reason: "Mole relationships support quantitative acid-base work." },
  { subject: "History", conceptId: "french_revolution", prerequisiteId: "enlightenment", reason: "Enlightenment ideas explain the revolution's causes." },
];

export function prerequisitesFor(subject: string | null, conceptId: string): PrerequisiteEdge[] {
  return PREREQUISITE_GRAPH.filter(
    (edge) => edge.conceptId === conceptId && (!subject || edge.subject === subject),
  );
}

export async function getPrerequisites(subject: string | null, conceptId: string): Promise<PrerequisiteEdge[]> {
  if (subject) {
    const rows = await db
      .select({
        subject: conceptPrerequisiteTable.subject,
        conceptId: conceptPrerequisiteTable.conceptId,
        prerequisiteId: conceptPrerequisiteTable.prerequisiteId,
        reason: conceptPrerequisiteTable.reason,
      })
      .from(conceptPrerequisiteTable)
      .where(and(
        eq(conceptPrerequisiteTable.subject, subject),
        eq(conceptPrerequisiteTable.conceptId, conceptId),
      ));
    if (rows.length) return rows;
  }
  return prerequisitesFor(subject, conceptId);
}