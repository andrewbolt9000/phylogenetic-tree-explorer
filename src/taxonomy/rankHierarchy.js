/**
 * Rank Hierarchy Map
 * 
 * Defines the ordering of taxonomic ranks where known.
 * This is INFORMATIONAL ONLY - actual parent-child relationships
 * must come from taxonomy lineage data, never from rank comparison.
 * 
 * Not all ranks can be ordered relative to each other (e.g., "no rank" has unknown position).
 */

// Standard Linnaean hierarchy (well-established)
const LINNAEAN_HIERARCHY = [
  'domain',
  'kingdom',
  'phylum',
  'subphylum',
  'superclass',
  'class',
  'subclass',
  'infraclass',
  'cohort',
  'subcohort',
  'superorder',
  'order',
  'suborder',
  'infraorder',
  'parvorder',
  'superfamily',
  'family',
  'subfamily',
  'tribe',
  'subtribe',
  'genus',
  'subgenus',
  'section',
  'subsection',
  'species group',
  'species subgroup',
  'species',
  'subspecies'
];

// Create a reverse index for quick lookups
const RANK_INDEX = {};
LINNAEAN_HIERARCHY.forEach((rank, index) => {
  RANK_INDEX[rank.toLowerCase()] = index;
});

/**
 * Check if rank1 is higher (more inclusive) than rank2 in the hierarchy.
 * 
 * Returns null if either rank cannot be positioned (e.g., "no rank").
 * 
 * @param {string} rank1 - The potentially higher rank
 * @param {string} rank2 - The potentially lower rank
 * @returns {boolean|null} - true if rank1 > rank2, false if rank1 < rank2, null if incomparable
 */
export function isRankHigher(rank1, rank2) {
  if (!rank1 || !rank2) return null;
  
  const key1 = rank1.toLowerCase();
  const key2 = rank2.toLowerCase();
  
  const idx1 = RANK_INDEX[key1];
  const idx2 = RANK_INDEX[key2];
  
  // If either rank is not in the hierarchy, we can't compare
  if (idx1 === undefined || idx2 === undefined) {
    return null;
  }
  
  return idx1 < idx2; // Lower index = higher rank
}

/**
 * Get the rank hierarchy level (index), or null if unranked.
 * 
 * @param {string} rank - The taxonomic rank
 * @returns {number|null} - 0-based index in hierarchy, or null if unknown rank
 */
export function getRankLevel(rank) {
  if (!rank) return null;
  const key = rank.toLowerCase();
  return RANK_INDEX[key] ?? null;
}

/**
 * Check if a rank is formally ranked in Linnaean hierarchy.
 * 
 * @param {string} rank - The taxonomic rank
 * @returns {boolean} - true if rank is in standard hierarchy
 */
export function isRanked(rank) {
  if (!rank) return false;
  return RANK_INDEX[rank.toLowerCase()] !== undefined;
}

/**
 * Get all known ranks in hierarchy order (most inclusive to least).
 * 
 * @returns {string[]} - Array of rank names in hierarchy order
 */
export function getAllRanks() {
  return [...LINNAEAN_HIERARCHY];
}

export { LINNAEAN_HIERARCHY, RANK_INDEX };
