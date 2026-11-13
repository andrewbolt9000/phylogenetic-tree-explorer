/**
 * Display Name Resolver
 * 
 * Reusable utility for resolving human-readable display names for phylogenetic nodes.
 * Supports both terminal taxa and internal ancestral nodes, with fallback chains for robustness.
 * 
 * Does not modify input objects or the taxonomy data.
 */

/**
 * Resolve a human-readable display name for a phylogenetic node.
 * 
 * Resolution strategy (in order of preference):
 * 1. If node has a taxonId and matching taxonomy record:
 *    - If preferCommonName is true, use commonName (fallback to scientificName)
 *    - If preferCommonName is false, use scientificName (fallback to commonName)
 * 2. If no usable taxonomy name, use sourceLabel (if present on node)
 * 3. If taxonId exists but no taxonomy record or sourceLabel, use taxonId (diagnostic)
 * 4. Otherwise, return "Unidentified node"
 * 
 * @param {object} node - Phylogenetic node with id, type, taxonId (optional), sourceLabel (optional)
 * @param {object} taxonomy - Map of taxonId -> {id, scientificName, commonName, ...}
 * @param {object} options - Optional parameters
 * @param {boolean} options.preferCommonName - If true, prefer commonName over scientificName (default: false)
 * @returns {string} Display name for the node
 */
export function resolveDisplayName(node, taxonomy = {}, options = {}) {
  const { preferCommonName = false } = options;

  if (!node) {
    return 'Unidentified node';
  }

  // If the node has a taxonId, try to resolve it from taxonomy
  if (node.taxonId) {
    const taxon = taxonomy[node.taxonId];
    
    if (taxon) {
      // Taxonomy record exists; use scientific or common name based on preference
      if (preferCommonName) {
        // Prefer common name, fall back to scientific name
        if (taxon.commonName) {
          return taxon.commonName;
        }
        if (taxon.scientificName) {
          return taxon.scientificName;
        }
      } else {
        // Prefer scientific name, fall back to common name (default behavior)
        if (taxon.scientificName) {
          return taxon.scientificName;
        }
        if (taxon.commonName) {
          return taxon.commonName;
        }
      }
    }
    
    // Taxonomy record not found; try sourceLabel as fallback
    if (node.sourceLabel) {
      return node.sourceLabel;
    }
    
    // No taxonomy record and no sourceLabel; use taxonId as diagnostic
    return node.taxonId;
  }

  // No taxonId; use sourceLabel if available
  if (node.sourceLabel) {
    return node.sourceLabel;
  }

  // No usable information found
  return 'Unidentified node';
}
