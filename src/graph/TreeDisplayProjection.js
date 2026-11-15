/**
 * TreeDisplayProjection - Generate a read-only display projection of the phylogenetic tree.
 *
 * This class creates a display-only projection that separates the original immutable
 * scientific graph from display logic. It projects which nodes and links should be
 * displayed based on the current visibility state, without modifying the underlying
 * graph or visibility state.
 *
 * Projection contains:
 * - visibleNodeIds: Set of currently visible node IDs
 * - biologicalLinks: Original parent-child edges where both endpoints are visible
 * - abbreviatedLinks: Display-only synthetic connections for sampled terminals
 *
 * The projection is ephemeral and reflects the current visibility state and active
 * sampling. Sampling is stable (regenerated only on specific events) and is stored
 * explicitly with its collapsed ancestor.
 */

class TreeDisplayProjection {
  /**
   * Construct a display projection.
   *
   * @param {PhyloGraph} graph - The immutable phylogenetic graph
   * @param {TreeVisibilityState} visibilityState - The current visibility state
   * @param {Object} options - Configuration options
   * @param {number} options.maxSampledSpecies - Maximum terminals in a sample (default 10)
   * @throws {Error} if graph or visibilityState is missing
   */
  constructor(graph, visibilityState, options = {}) {
    if (!graph) {
      throw new Error('TreeDisplayProjection requires a PhyloGraph');
    }
    if (!visibilityState) {
      throw new Error('TreeDisplayProjection requires a TreeVisibilityState');
    }

    this.graph = graph;
    this.visibilityState = visibilityState;

    this.options = {
      maxSampledSpecies: 10,
      ...options
    };

    // Active samples: Map<ancestorId, { terminalIds: Set }>
    // Multiple simultaneous samples, one per ancestor
    this._activeSamples = new Map();

    // Cache the projection (rebuilt if visibility state changes)
    this._projection = this._generateProjection();
  }

  /**
   * Set the maximum number of species in active samples.
   * Regenerates all active samples with the new maximum.
   * 
   * @param {number} max - Maximum species count (1-50)
   */
  setMaxSampledSpecies(max) {
    const newMax = Math.max(1, Math.min(max, 50));
    this.options.maxSampledSpecies = newMax;

    // Regenerate all active samples with the new maximum
    for (const ancestorId of this._activeSamples.keys()) {
      this._generateBranchFairSample(ancestorId, newMax);
    }

    // Rebuild projection to reflect new samples
    this._projection = this._generateProjection();
  }

  /**
   * Toggle sample for a specific ancestor.
   * If ancestor already has a sample, clear it.
   * Otherwise, create a new sample for that ancestor.
   * Other samples remain active.
   * 
   * @param {string} ancestorId - The collapsed ancestor to sample from
   */
  generateSample(ancestorId) {
    // Root Alt-click collapses the tree; don't sample the root
    if (ancestorId === this.visibilityState.rootNodeId) {
      return;
    }

    // If sample exists for this ancestor, clear it
    if (this._activeSamples.has(ancestorId)) {
      this.clearSample(ancestorId);
      return;
    }

    // Generate a branch-fair sample for this ancestor
    this._generateBranchFairSample(ancestorId, this.options.maxSampledSpecies);

    // Rebuild projection with the new sample (keeping others)
    this._projection = this._generateProjection();
  }

  /**
   * Clear sample for a specific ancestor.
   * Other samples remain active.
   * 
   * @param {string} ancestorId - The ancestor to clear (optional; if not provided, clear all)
   */
  clearSample(ancestorId) {
    if (ancestorId === undefined) {
      // Clear all samples
      this._activeSamples.clear();
    } else {
      // Clear sample for specific ancestor
      this._activeSamples.delete(ancestorId);
    }
    this._projection = this._generateProjection();
  }

  /**
   * Get the active sample for a specific ancestor, if any.
   * Returns the ancestor and sampled terminal IDs.
   *
   * @param {string} ancestorId - The ancestor to query
   * @returns {Object|null} { ancestorId, terminalIds: Set } or null if no sample for this ancestor
   */
  getSampleForAncestor(ancestorId) {
    const sample = this._activeSamples.get(ancestorId);
    if (!sample) {
      return null;
    }
    return {
      ancestorId,
      terminalIds: new Set(sample.terminalIds)
    };
  }

  /**
   * Get all active samples.
   * Returns a map of ancestor ID to sample data.
   *
   * @returns {Map} Map<ancestorId, { terminalIds: Set }>
   */
  getAllActiveSamples() {
    const result = new Map();
    for (const [ancestorId, sample] of this._activeSamples.entries()) {
      result.set(ancestorId, {
        ancestorId,
        terminalIds: new Set(sample.terminalIds)
      });
    }
    return result;
  }

  /**
   * Get list of ancestor IDs that have active samples.
   *
   * @returns {Array} Array of ancestor IDs
   */
  getSampledAncestors() {
    return Array.from(this._activeSamples.keys());
  }

  /**
   * Get the active sample, if any (for backwards compatibility).
   * Returns the first active sample if multiple exist, or null if none.
   * This is deprecated; use getAllActiveSamples() instead.
   *
   * @returns {Object|null} { ancestorId, terminalIds: Set } or null if no active samples
   */
  getActiveSample() {
    if (this._activeSamples.size === 0) {
      return null;
    }
    // Return first sample (for backwards compatibility with existing code)
    const [ancestorId, sample] = this._activeSamples.entries().next().value;
    return {
      ancestorId,
      terminalIds: new Set(sample.terminalIds)
    };
  }

  /**
   * Get the current projection.
   * Returns a snapshot of the current display projection.
   * Safe for consumption; returned objects are fresh copies.
   *
   * @returns {Object} Projection with visibleNodeIds, biologicalLinks, abbreviatedLinks
   */
  getProjection() {
    // Return a fresh copy to prevent mutation of internal state
    return {
      visibleNodeIds: new Set(this._projection.visibleNodeIds),
      biologicalLinks: this._projection.biologicalLinks.map(link => ({
        sourceId: link.sourceId,
        targetId: link.targetId,
        type: link.type
      })),
      abbreviatedLinks: this._projection.abbreviatedLinks.map(link => ({
        sourceId: link.sourceId,
        targetId: link.targetId,
        type: link.type
      }))
    };
  }

  /**
   * Get visible node IDs from the current projection.
   *
   * @returns {Set} Set of visible node IDs
   */
  getVisibleNodeIds() {
    return new Set(this._projection.visibleNodeIds);
  }

  /**
   * Get biological links from the current projection.
   * These are original edges where both endpoints are visible.
   *
   * @returns {Array} Array of { sourceId, targetId, type: 'biological' }
   */
  getBiologicalLinks() {
    return this._projection.biologicalLinks.map(link => ({
      sourceId: link.sourceId,
      targetId: link.targetId,
      type: link.type
    }));
  }

  /**
   * Get abbreviated links from the current projection.
   * These are display-only synthetic connections for sampled terminals.
   *
   * @returns {Array} Array of { sourceId, targetId, type: 'abbreviated' }
   */
  getAbbreviatedLinks() {
    return this._projection.abbreviatedLinks.map(link => ({
      sourceId: link.sourceId,
      targetId: link.targetId,
      type: link.type
    }));
  }

  /**
   * Get all links (biological + abbreviated) for display.
   *
   * @returns {Array} Combined array of both biological and abbreviated links
   */
  getAllLinks() {
    return [
      ...this.getBiologicalLinks(),
      ...this.getAbbreviatedLinks()
    ];
  }

  /**
   * Reshuffle an existing sample for an ancestor with a new branch-fair random sample.
   * Replaces the existing sample with a new one without changing the ancestor or ancestry.
   * If no sample exists, generates a new one.
   * If the ancestor is the root, does nothing.
   *
   * @param {string} ancestorId - The ancestor whose sample to reshuffle
   */
  reshuffleSample(ancestorId) {
    if (ancestorId === this.visibilityState.rootNodeId) {
      return;
    }

    // Clear existing sample and generate a new one
    this._activeSamples.delete(ancestorId);
    this._generateBranchFairSample(ancestorId, this.options.maxSampledSpecies);

    // Rebuild projection
    this._projection = this._generateProjection();
  }

  /**
   * Add sampled terminals to an existing sample for an ancestor.
   * If no sample exists, generates a new one.
   * Preserves existing sampled terminal IDs and selects additional terminals
   * up to the configured maximum, distributed fairly across branches.
   * If already at maximum, does nothing.
   *
   * @param {string} ancestorId - The ancestor whose sample to expand
   */
  addToSample(ancestorId) {
    if (ancestorId === this.visibilityState.rootNodeId) {
      return;
    }

    const existingSample = this._activeSamples.get(ancestorId);
    const currentCount = existingSample ? existingSample.terminalIds.size : 0;

    // If not at max, add more terminals
    if (currentCount < this.options.maxSampledSpecies) {
      if (!existingSample) {
        // No existing sample; generate one normally
        this._generateBranchFairSample(ancestorId, this.options.maxSampledSpecies);
      } else {
        // Extend existing sample with additional terminals
        this._expandSampleFairly(ancestorId, existingSample);
      }

      // Rebuild projection
      this._projection = this._generateProjection();
    }
    // If already at max, do nothing
  }

  /**
   * Safely add sampled terminals to an existing sample while preserving existing terminal IDs.
   * Selects additional terminals from available descendants that are not already sampled,
   * distributed fairly across branches.
   *
   * @param {string} ancestorId - The ancestor node
   * @param {Object} existingSample - Existing sample with { terminalIds: Set }
   * @private
   */
  _expandSampleFairly(ancestorId, existingSample) {
    const children = this.graph.getChildren(ancestorId);
    if (children.length === 0) {
      return;
    }

    const currentTerminals = existingSample.terminalIds;
    const additionalSlots = this.options.maxSampledSpecies - currentTerminals.size;

    if (additionalSlots <= 0) {
      return;
    }

    // Collect available terminals for each branch (excluding already-sampled)
    const branchTerminals = [];
    for (const childId of children) {
      const terminals = this._getTerminalDescendantsOf(childId);
      const available = terminals.filter(t => !currentTerminals.has(t));
      if (available.length > 0) {
        branchTerminals.push({ childId, terminals: available });
      }
    }

    if (branchTerminals.length === 0) {
      return; // No additional terminals available
    }

    // Distribute additional slots fairly across branches
    const toAdd = [];
    let slotIndex = 0;
    while (toAdd.length < additionalSlots && branchTerminals.some(b => slotIndex < b.terminals.length)) {
      for (const branch of branchTerminals) {
        if (toAdd.length >= additionalSlots) {
          break;
        }
        if (slotIndex < branch.terminals.length) {
          toAdd.push(branch.terminals[slotIndex]);
        }
      }
      slotIndex++;
    }

    // Add new terminals to existing sample
    for (const terminalId of toAdd) {
      currentTerminals.add(terminalId);
    }
  }

  /**
   * Regenerate the projection after visibility state changes.
   * Typically called after tree manipulation operations.
   * This is safe to call repeatedly; it will rebuild the projection
   * to reflect the latest visibility state while preserving the active sample.
   */
  regenerate() {
    this._projection = this._generateProjection();
  }

  /**
   * Invalidate sample for a specific node if it's a sampling ancestor.
   * Called when tree manipulation makes a sample's ancestor invalid.
   * Only clears the sample for the specific ancestor, not all samples.
   * 
   * @param {string} nodeId - The node that was changed
   */
  invalidateSampleIfAncestorChanged(nodeId) {
    if (this._activeSamples.has(nodeId)) {
      this.clearSample(nodeId);
    }
  }

  /**
   * Generate the display projection from the current state.
   * Internal method; use getProjection() or regenerate() externally.
   *
   * @returns {Object} Internal projection object
   * @private
   */
  _generateProjection() {
    const visibleNodeIds = this._getVisibleNodeIds();
    const biologicalLinks = this._generateBiologicalLinks(visibleNodeIds);
    const abbreviatedLinks = this._generateAbbreviatedLinks(visibleNodeIds);

    return {
      visibleNodeIds,
      biologicalLinks,
      abbreviatedLinks
    };
  }

  /**
   * Get the set of currently visible node IDs, including sampled terminals.
   *
   * @returns {Set} Set of visible node IDs
   * @private
   */
  _getVisibleNodeIds() {
    // If no active samples, return all visibility state nodes as-is
    if (this._activeSamples.size === 0) {
      return new Set(this.visibilityState.getVisibleNodeIds());
    }
    
    // With active samples, exclude non-sampled terminals that are direct children of sampled collapsed ancestors
    const visible = new Set();
    const sampledAncestorIds = new Set(this._activeSamples.keys());
    
    // Add nodes from visibility state, except non-sampled terminals that are direct children of sampled collapsed ancestors
    for (const nodeId of this.visibilityState.getVisibleNodeIds()) {
      const parent = this.graph.getParent(nodeId);
      const children = this.graph.getChildren(nodeId);
      
      // Include if:
      // - It's an internal node (has children), OR
      // - Its parent is not a sampled ancestor, OR
      // - Its parent is sampled but NOT collapsed (e.g., STATE C where we want both bio and abbreviated)
      const isInternal = children.length > 0;
      const parentIsSampled = parent && sampledAncestorIds.has(parent);
      const parentIsCollapsed = parent && this.visibilityState.isNodeCollapsed(parent);
      
      if (isInternal || !parentIsSampled || (parentIsSampled && !parentIsCollapsed)) {
        visible.add(nodeId);
      }
    }
    
    // Add sampled terminals from all active samples (deduplicated by Set)
    for (const sample of this._activeSamples.values()) {
      for (const terminalId of sample.terminalIds) {
        visible.add(terminalId);
      }
    }
    
    return visible;
  }

  /**
   * Generate biological links: original edges where both endpoints are visible.
   *
   * A biological link exists if and only if:
   * 1. There is an actual edge in the original PhyloGraph (parent-child)
   * 2. Both the parent and child nodes are currently visible
   *
   * @returns {Array} Array of { sourceId, targetId, type: 'biological' }
   * @private
   */
  _generateBiologicalLinks(visibleNodeIds) {
    const links = [];

    // Iterate through all visible nodes
    for (const childId of visibleNodeIds) {
      // Get the parent of this child (from the original graph)
      const parentId = this.graph.getParent(childId);

      // If the parent exists and is also visible, add a biological link
      if (parentId && visibleNodeIds.has(parentId)) {
        links.push({
          sourceId: parentId,
          targetId: childId,
          type: 'biological'
        });
      }
    }

    return links;
  }

  /**
   * Find the deepest (closest to terminal) visible ancestor of a given node.
   * Walks up the biological tree from the node's parent until finding the first (deepest) visible ancestor.
   * Returns as soon as finding a visible ancestor.
   *
   * @param {string} nodeId - The node to find the deepest visible ancestor of
   * @param {Set} visibleNodeIds - Set of currently visible node IDs
   * @returns {string|null} The deepest visible ancestor ID, or null if none found
   * @private
   */
  _findDeepestVisibleAncestor(nodeId, visibleNodeIds) {
    // Start from the parent (skip the node itself)
    let currentId = this.graph.getParent(nodeId);

    // Walk up the tree from parent, return the first (deepest) visible ancestor
    while (currentId) {
      if (visibleNodeIds.has(currentId)) {
        // Found the deepest visible ancestor
        return currentId;
      }
      currentId = this.graph.getParent(currentId);
    }

    // No visible ancestor found
    return null;
  }

  /**
   * Generate abbreviated links: display-only connections for sampled terminals.
   * Implements dynamic re-anchoring: abbreviated links connect each sampled terminal
   * to its deepest visible ancestor.
   *
   * For each sampled terminal in ALL active samples:
   * 1. Check if its direct biological parent is visible
   *    - If yes: no abbreviated link needed (biological edge handles it)
   *    - If no: create abbreviated link from deepest visible ancestor to terminal
   *
   * Abbreviated links are deduplicated: if the same ancestor→terminal connection
   * appears in multiple samples, only one link is returned.
   *
   * This allows abbreviated links to progressively move down the tree as users expand
   * successive levels.
   *
   * @param {Set} visibleNodeIds - Set of currently visible node IDs
   * @returns {Array} Array of { sourceId, targetId, type: 'abbreviated' }
   * @private
   */
  _generateAbbreviatedLinks(visibleNodeIds) {
    const linkSet = new Set(); // Deduplicate using "sourceId|targetId" strings

    // Process terminals from ALL active samples
    for (const sample of this._activeSamples.values()) {
      for (const terminalId of sample.terminalIds) {
        // Check if the terminal's direct biological parent is visible AND expanded
        const parentId = this.graph.getParent(terminalId);
        const parentIsVisible = parentId && visibleNodeIds.has(parentId);
        const parentIsExpanded = parentId && !this.visibilityState.isNodeCollapsed(parentId);

        if (!parentIsVisible || !parentIsExpanded) {
          // Parent is not visible OR collapsed, so we need an abbreviated link
          // Find the deepest visible ancestor to anchor the connection
          const deepestVisibleAncestor = this._findDeepestVisibleAncestor(terminalId, visibleNodeIds);

          if (deepestVisibleAncestor && deepestVisibleAncestor !== terminalId) {
            // Create link key for deduplication
            const linkKey = `${deepestVisibleAncestor}|${terminalId}`;
            linkSet.add(linkKey);
          }
        }
        // If parent is visible AND expanded, the biological link handles the connection
      }
    }

    // Convert link keys back to link objects
    const links = Array.from(linkSet).map(linkKey => {
      const [sourceId, targetId] = linkKey.split('|');
      return {
        sourceId,
        targetId,
        type: 'abbreviated'
      };
    });

    return links;
  }

  /**
   * Generate a branch-fair sample of an ancestor's terminal descendants.
   * Distributes samples fairly across immediate child branches.
   * 
   * @param {string} ancestorId - The ancestor to sample from
   * @param {number} maxSample - Maximum number of terminals to select
   * @private
   */
  _generateBranchFairSample(ancestorId, maxSample) {
    // Get immediate children (branches) of the ancestor
    const children = this.graph.getChildren(ancestorId);
    if (children.length === 0) {
      // No children to sample from; remove sample if it exists
      this._activeSamples.delete(ancestorId);
      return;
    }

    // For each branch, collect all terminal descendants
    const branchTerminals = [];
    for (const childId of children) {
      const terminals = this._getTerminalDescendantsOf(childId);
      if (terminals.length > 0) {
        branchTerminals.push({ childId, terminals });
      }
    }

    if (branchTerminals.length === 0) {
      // No terminals found; remove sample if it exists
      this._activeSamples.delete(ancestorId);
      return;
    }

    // Distribute samples across branches fairly
    const sampled = this._distributeSampleAcrossBranches(branchTerminals, maxSample);

    // Store sample in the map (add to existing or replace if regenerating)
    this._activeSamples.set(ancestorId, {
      terminalIds: new Set(sampled)
    });
  }

  /**
   * Distribute a maximum sample count fairly across branches.
   * Uses round-robin selection to avoid biasing toward large branches.
   * 
   * @param {Array} branchTerminals - Array of { childId, terminals: Array }
   * @param {number} maxSample - Maximum sample size
   * @returns {Array} Sampled terminal node IDs
   * @private
   */
  _distributeSampleAcrossBranches(branchTerminals, maxSample) {
    const sampled = [];
    const usedIndices = new Set();

    // Randomize order of branches to avoid bias
    const shuffledBranches = this._shuffleArray([...branchTerminals]);

    // Round-robin selection across branches
    let round = 0;
    while (sampled.length < maxSample) {
      let foundAny = false;

      for (const branch of shuffledBranches) {
        if (sampled.length >= maxSample) break;

        // Get all unused terminals from this branch
        const available = branch.terminals.filter((_, idx) => !usedIndices.has(`${branch.childId}:${idx}`));

        if (available.length > round) {
          // Select from this branch in this round
          const randomIdx = Math.floor(Math.random() * available.length);
          const selectedTerminal = available[randomIdx];
          sampled.push(selectedTerminal);

          // Mark as used
          const originalIdx = branch.terminals.indexOf(selectedTerminal);
          usedIndices.add(`${branch.childId}:${originalIdx}`);

          foundAny = true;
        }
      }

      if (!foundAny) break; // No more terminals available
      round++;
    }

    return sampled;
  }

  /**
   * Get all terminal descendants of a node.
   * 
   * @param {string} nodeId - The node to get terminals from
   * @returns {Array} Array of terminal node IDs
   * @private
   */
  _getTerminalDescendantsOf(nodeId) {
    const terminals = [];
    const toVisit = [nodeId];

    while (toVisit.length > 0) {
      const current = toVisit.shift();
      const children = this.graph.getChildren(current);

      if (children.length === 0) {
        // Terminal node
        terminals.push(current);
      } else {
        // Internal node - add children to visit
        for (const childId of children) {
          toVisit.push(childId);
        }
      }
    }

    return terminals;
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm.
   * 
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled copy of array
   * @private
   */
  _shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

export { TreeDisplayProjection };
