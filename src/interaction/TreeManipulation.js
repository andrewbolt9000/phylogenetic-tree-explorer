/**
 * TreeManipulation - Handles click interactions for tree collapse/expand operations
 *
 * Manages user interactions with phylogenetic tree nodes:
 * - Normal click: expand one level
 * - Shift-click: expand entire subtree
 * - Alt-click: collapse or random sampling
 *
 * Reuses existing TreeVisibilityState engine and visualization refresh mechanism.
 * Uses TreeDisplayProjection to generate the display-only projection.
 */

import { TreeDisplayProjection } from '../graph/TreeDisplayProjection.js';

class TreeManipulation {
  /**
   * Construct a tree manipulation handler.
   *
   * @param {PhyloGraph} graph - The immutable phylogenetic graph
   * @param {TreeVisibilityState} visibilityState - The visibility state engine
   * @param {ForceDirectedVisualization} visualization - The visualization renderer
   * @param {Array} allNodes - Complete original visualization node array
   * @param {Array} allLinks - Complete original visualization link array
   * @param {Object} options - Configuration options
   */
  constructor(graph, visibilityState, visualization, allNodes = null, allLinks = null, options = {}) {
    this.graph = graph;
    this.visibilityState = visibilityState;
    this.visualization = visualization;
    this.allNodes = allNodes;  // Complete original nodes for filtering
    this.allLinks = allLinks;  // Complete original links for filtering

    this.options = {
      maxSampledSpecies: 10,  // Maximum terminal species in sampling
      ...options
    };

    // Create the display projection with sampling options
    this.projection = new TreeDisplayProjection(graph, visibilityState, {
      maxSampledSpecies: this.options.maxSampledSpecies
    });

    // Current interaction state
    this.isDragging = false;
  }

  /**
   * Handle a click event on a node.
   * Route to appropriate handler based on modifier keys and node type.
   *
   * Recognized modifier actions:
   * - Command-click (event.metaKey): expand one level
   * - Control-click (event.ctrlKey): expand one level (Windows compatibility)
   * - Shift-click (event.shiftKey): recursively expand entire descendant subtree
   * - Alt-click (event.altKey): collapse or show random sample (depends on state)
   *
   * Normal clicks do nothing (allows D3 drag to work independently).
   *
   * @param {Object} nodeData - The visualization node being clicked
   * @param {MouseEvent} event - The click event
   */
  handleNodeClick(nodeData, event) {
    if (this.isDragging) {
      return;
    }

    // Determine if this is an internal node using authoritative graph lookup
    const children = this.graph.getChildren(nodeData.id);
    const isInternal = children && children.length > 0;

    // Terminal nodes cannot be manipulated
    if (!isInternal) {
      return;
    }

    // Check if node ID is valid
    const graphNode = this.graph.getNodes().get(nodeData.id);
    if (!graphNode) {
      return;
    }

    // Route based on modifier keys
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      this._handleCommandClick(nodeData.id);
      this._refreshVisualization();
    } else if (event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      this._handleShiftClick(nodeData.id);
      this._refreshVisualization();
    } else if (event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      this._handleAltClick(nodeData.id);
      this._refreshVisualization();
    }
    // Normal click: no tree manipulation (allow dragging to work)
  }

  /**
   * Safely expand a node one biological generation, even if it's not in collapsedNodeIds.
   * This is needed because Alt-click removes the node from collapsedNodeIds but we still
   * want Command-click to expand it.
   *
   * Makes every immediate biological child visible.
   * Newly revealed internal children are marked as collapsed.
   * Marks the node as expanded.
   * Preserves existing samples.
   * Regenerates projection for abbreviated link re-anchoring.
   *
   * @param {string} nodeId - The node to expand
   * @private
   */
  _safeExpandNodeOneLevel(nodeId) {
    if (!this.visibilityState.isNodeVisible(nodeId)) {
      return;
    }

    const children = this.graph.getChildren(nodeId);
    if (children.length === 0) {
      return; // Terminal node, nothing to expand
    }

    // Make all immediate children visible
    for (const childId of children) {
      this.visibilityState.visibleNodeIds.add(childId);

      // If child is internal (has descendants), mark it as collapsed initially
      const childChildren = this.graph.getChildren(childId);
      if (childChildren.length > 0) {
        this.visibilityState.collapsedNodeIds.add(childId);
      }
    }

    // Mark this node as expanded (not collapsed)
    this.visibilityState.collapsedNodeIds.delete(nodeId);

    // Regenerate projection to re-anchor abbreviated links to newly visible children
    this.projection.regenerate();
  }

  /**
   * Command-click (or Control-click on Windows): behavior based on node's projected connections.
   * 
   * Classifies the node by its actual outgoing connections in the current display projection:
   * 1. Direct biological connections only → collapse all descendants
   * 2. Abbreviated connections only → expand one level (progressive exploration)
   * 3. Both types → expand one level (keep biological children visible, re-anchor abbreviated)
   * 4. Neither type → expand one level
   * 
   * @private
   */
  _handleCommandClick(nodeId) {
    // Verify node is visible
    if (!this.visibilityState.isNodeVisible(nodeId)) {
      return;
    }

    // Classify node by its actual projected connections
    const connectionState = this._classifyNodeConnections(nodeId);

    if (connectionState.hasBiological && !connectionState.hasAbbreviated) {
      // STATE A: Direct biological connections only
      // COLLAPSE all descendants
      
      // Remove sample for this node if it exists
      const sampleForNode = this.projection.getSampleForAncestor(nodeId);
      if (sampleForNode) {
        this.projection.clearSample(nodeId);
      }

      // Collapse all descendants
      this.visibilityState.collapseNode(nodeId);

      // Invalidate sample for this node (if it had one)
      this.projection.invalidateSampleIfAncestorChanged(nodeId);
    } else {
      // STATES B, C, D: Abbreviated connections only, or both, or neither
      // EXPAND one level (progressive exploration)
      
      // Use safe expand that works even if node is not in collapsedNodeIds
      this._safeExpandNodeOneLevel(nodeId);
    }
  }

  /**
   * Shift-click behavior: Toggle between collapse and full expand.
   * 
   * Based on whether the node currently has visible descendants:
   * 
   * - If node has ANY visible descendants (including ordinary biological children,
   *   abbreviated sampled terminals, and nested descendants):
   *   → Collapse all descendants completely
   *   → Remove all visible descendants and associated abbreviated connections
   *   → Clear samples and re-anchor remaining samples
   * 
   * - If node has NO visible descendants:
   *   → Expand the ENTIRE subtree (all descendants become visible)
   *   → Reveal all levels recursively, not just one level
   *   → Preserve unrelated branches and samples
   * 
   * This is a toggle based on projected display state (including abbreviated links),
   * not just the original graph's children array.
   * 
   * @private
   */
  _handleShiftClick(nodeId) {
    // Node must be visible to interact with it
    if (!this.visibilityState.isNodeVisible(nodeId)) {
      return;
    }

    // Get the current projection to check for visible descendants
    const projection = this.projection.getProjection();
    const visibleNodeIds = projection.visibleNodeIds;
    
    // Check if this node has any visible descendants
    // Include both ordinary biological descendants and abbreviated sampled terminals
    const hasVisibleDescendants = this._hasVisibleDescendants(nodeId, visibleNodeIds);
    
    if (hasVisibleDescendants) {
      // COLLAPSE: Hide all descendants
      this.visibilityState.collapseNode(nodeId);
      
      // Clear sample for this node if it has one
      // This also triggers re-anchoring for other active samples
      this.projection.invalidateSampleIfAncestorChanged(nodeId);
    } else {
      // EXPAND: Reveal entire subtree (all descendants recursively)
      this._expandEntireSubtree(nodeId);
      
      // Re-anchor any existing samples to newly visible ancestors
      this.projection.regenerate();
    }
  }

  /**
   * Check if a node has any visible descendants in the current projection.
   * Includes both ordinary biological descendants and abbreviated sampled terminals.
   * 
   * @private
   * @param {string} nodeId - Node to check
   * @param {Set} visibleNodeIds - Set of currently visible node IDs
   * @returns {boolean} True if node has any visible descendants
   */
  _hasVisibleDescendants(nodeId, visibleNodeIds) {
    // Get all descendants of this node (original graph)
    const allDescendants = this._getAllDescendants(nodeId);
    
    // Check if any descendant is currently visible
    for (const descendantId of allDescendants) {
      if (visibleNodeIds.has(descendantId)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Expand entire subtree: recursively make all descendants visible.
   * This reveals the complete original biological subtree beneath a node.
   * 
   * @private
   * @param {string} nodeId - Root node of subtree to expand
   */
  _expandEntireSubtree(nodeId) {
    // Get all descendants from the original graph
    const allDescendants = this._getAllDescendants(nodeId);
    
    // Make all descendants visible by removing them from collapsed set
    // Start by uncollapsing the root node
    this.visibilityState.collapsedNodeIds.delete(nodeId);
    
    // Uncollapse all internal descendants
    for (const descendantId of allDescendants) {
      const graphNode = this.graph.getNodes().get(descendantId);
      if (graphNode && graphNode.type === 'internal') {
        this.visibilityState.collapsedNodeIds.delete(descendantId);
      }
    }
    
    // Ensure all descendants are marked visible
    for (const descendantId of allDescendants) {
      this.visibilityState.visibleNodeIds.add(descendantId);
    }
  }

  /**
   * Alt-click behavior depends on node's actual projected connections and the configured sample limit.
   * Root Alt-click is disabled.
   *
   * STATE A (direct biological only): Collapse all descendants.
   * STATE B (abbreviated only): Reshuffle the sample with a new branch-fair random selection.
   * STATE C (both types): Keep biological children visible; add to sample if below max, reshuffle if at max.
   * STATE D (neither type): Generate a new branch-fair sample.
   *
   * Samples are never toggled off in Alt-click unless collapsing (STATE A).
   * Existing sampled terminal IDs are preserved when adding to a sample.
   * 
   * @private
   */
  _handleAltClick(nodeId) {
    if (nodeId === this.visibilityState.rootNodeId) {
      // Alt-click on root: DISABLED - do nothing
      return;
    }

    if (!this.visibilityState.isNodeVisible(nodeId)) {
      return;
    }

    // Classify node by its actual projected connections
    const connectionState = this._classifyNodeConnections(nodeId);

    if (connectionState.hasBiological && !connectionState.hasAbbreviated) {
      // STATE A: Direct biological connections only
      // Collapse all descendants and clear any sample
      this.visibilityState.collapseNode(nodeId);
      this.projection.invalidateSampleIfAncestorChanged(nodeId);
      this._removeOldSampledTerminals();
    } else if (!connectionState.hasBiological && connectionState.hasAbbreviated) {
      // STATE B: Abbreviated connections only
      // Reshuffle: replace the sample with a new branch-fair random one
      this.projection.reshuffleSample(nodeId);
      this._removeOldSampledTerminals();
      
      // Ensure new sampled terminals are visible
      const sample = this.projection.getSampleForAncestor(nodeId);
      if (sample) {
        for (const terminalId of sample.terminalIds) {
          this.visibilityState.visibleNodeIds.add(terminalId);
        }
      }
    } else if (connectionState.hasBiological && connectionState.hasAbbreviated) {
      // STATE C: Both biological and abbreviated connections
      // Keep biological children visible
      // If sample is below max, add to it; if at max, reshuffle it
      const currentSample = this.projection.getSampleForAncestor(nodeId);
      if (currentSample && currentSample.terminalIds.size >= this.options.maxSampledSpecies) {
        // At max: reshuffle instead of adding
        this.projection.reshuffleSample(nodeId);
        this._removeOldSampledTerminals();
      } else {
        // Below max or no sample: add to it
        this.projection.addToSample(nodeId);
      }

      // Ensure sampled terminals are visible
      const sample = this.projection.getSampleForAncestor(nodeId);
      if (sample) {
        for (const terminalId of sample.terminalIds) {
          this.visibilityState.visibleNodeIds.add(terminalId);
        }
      }
      // Keep biological children visible - do NOT collapse
    } else {
      // STATE D: Neither type of connection
      // Generate a branch-fair sample, keeping ancestor collapsed in biological tree
      const currentSample = this.projection.getSampleForAncestor(nodeId);
      if (currentSample && currentSample.terminalIds.size >= this.options.maxSampledSpecies) {
        // At max: reshuffle
        this.projection.reshuffleSample(nodeId);
        this._removeOldSampledTerminals();
      } else {
        // Below max or no sample: add to it
        this.projection.addToSample(nodeId);
      }

      // Add sampled terminals to visibility state so they are rendered
      const sample = this.projection.getSampleForAncestor(nodeId);
      if (sample) {
        for (const terminalId of sample.terminalIds) {
          this.visibilityState.visibleNodeIds.add(terminalId);
        }
        // Mark the node as not collapsed (it's now showing sampled descendants)
        this.visibilityState.collapsedNodeIds.delete(nodeId);
      }
    }
  }

  /**
   * Remove sampled terminals from visibility that are no longer needed.
   * A terminal should be removed if:
   * - It was in an old sample that was replaced or cleared, AND
   * - It's not in any remaining active sample, AND
   * - It's not visible through ordinary expanded tree structure
   *
   * This prevents floating nodes after sample reshuffling or clearing.
   *
   * @private
   */
  _removeOldSampledTerminals() {
    const remainingActiveSamples = this.projection.getAllActiveSamples();
    const terminalsNeededBySamples = new Set();

    // Collect all terminals needed by remaining active samples
    for (const sample of remainingActiveSamples.values()) {
      for (const terminalId of sample.terminalIds) {
        terminalsNeededBySamples.add(terminalId);
      }
    }

    // Remove terminals from visibility if they're not needed
    const currentVisible = Array.from(this.visibilityState.visibleNodeIds);
    for (const nodeId of currentVisible) {
      const isTerminal = this.graph.getChildren(nodeId).length === 0;
      if (isTerminal && !terminalsNeededBySamples.has(nodeId)) {
        // This terminal is not needed by any sample
        // Check if it's visible through ordinary tree structure
        const parent = this.graph.getParent(nodeId);
        const parentIsVisibleAndExpanded = parent &&
          this.visibilityState.isNodeVisible(parent) &&
          !this.visibilityState.isNodeCollapsed(parent);

        if (!parentIsVisibleAndExpanded) {
          // Not visible through tree structure, remove it
          this.visibilityState.visibleNodeIds.delete(nodeId);
        }
      }
    }
  }

  /**
   * Classify a node by its actual outgoing connections in the current display projection.
   * 
   * Returns an object with:
   * - hasBiological: true if node has visible immediate biological children
   * - hasAbbreviated: true if node is source of any abbreviated (dashed) link
   * 
   * This distinguishes the four node states:
   * 1. {hasBiological: true, hasAbbreviated: false} - Direct biological children only
   * 2. {hasBiological: false, hasAbbreviated: true} - Abbreviated children only
   * 3. {hasBiological: true, hasAbbreviated: true} - Both types
   * 4. {hasBiological: false, hasAbbreviated: false} - Neither type
   * 
   * @private
   * @param {string} nodeId - The node to classify
   * @returns {Object} Connection state object
   */
  _classifyNodeConnections(nodeId) {
    // Check for visible immediate biological children
    const hasBiological = this._hasVisibleBiologicalChildren(nodeId);

    // Check for abbreviated (dashed) outgoing connections
    const hasAbbreviated = this._hasAbbreviatedChildren(nodeId);

    return { hasBiological, hasAbbreviated };
  }

  /**
   * Safely clear a sample for a node, removing only sampled terminals that are not
   * required by other samples or the ordinary tree structure.
   * 
   * @private
   * @param {string} nodeId - The node whose sample to clear
   */
  _clearSampleAndRemoveTerminals(nodeId) {
    const sampleForNode = this.projection.getSampleForAncestor(nodeId);
    if (!sampleForNode) {
      return;
    }

    // Get all other active samples to check if terminals are needed elsewhere
    const otherSamples = this.projection.getAllActiveSamples();
    otherSamples.delete(nodeId);

    // Check which terminals from this sample are needed by other samples
    const terminalIdsToRemove = new Set();
    for (const terminalId of sampleForNode.terminalIds) {
      let neededByOtherSample = false;
      for (const otherSample of otherSamples.values()) {
        if (otherSample.terminalIds.has(terminalId)) {
          neededByOtherSample = true;
          break;
        }
      }

      if (!neededByOtherSample) {
        // Also check if terminal is visible through ordinary tree structure
        const terminalParent = this.graph.getParent(terminalId);
        const parentIsVisible = terminalParent && this.visibilityState.isNodeVisible(terminalParent);
        
        if (!parentIsVisible) {
          // Terminal not needed by other samples and not visible through ordinary tree
          terminalIdsToRemove.add(terminalId);
        }
      }
    }

    // Remove only the terminals that are not needed elsewhere
    for (const terminalId of terminalIdsToRemove) {
      this.visibilityState.visibleNodeIds.delete(terminalId);
    }

    // Clear the sample
    this.projection.clearSample(nodeId);
  }

  /**
   * Set the maximum number of terminal species shown in sampling.
   * Syncs with the projection to update active samples if needed.
   * @param {number} max - Maximum species count (1-50 range)
   */
  setMaxSampledSpecies(max) {
    const newMax = Math.max(1, Math.min(max, 50));
    this.options.maxSampledSpecies = newMax;
    // Sync with projection
    this.projection.setMaxSampledSpecies(newMax);
  }

  /**
   * Collapse Entire Tree operation: call the visibility engine's collapseToRoot.
   * Clears all active samples.
   */
  collapseEntireTree() {
    this.visibilityState.collapseToRoot();
    this.projection.clearSample(); // Clear all samples (no argument)
    this._refreshVisualization();
  }

  /**
   * Get all descendants of a node (recursively).
   * Returns a Set of all descendant node IDs.
   * @private
   * @param {string} nodeId - Root node
   * @returns {Set<string>} Set of all descendant IDs (not including the node itself)
   */
  _getAllDescendants(nodeId) {
    const descendants = new Set();
    const children = this.graph.getChildren(nodeId);
    
    for (const childId of children) {
      descendants.add(childId);
      // Recursively add descendants of children
      const grandchildren = this._getAllDescendants(childId);
      for (const grandchildId of grandchildren) {
        descendants.add(grandchildId);
      }
    }
    
    return descendants;
  }

  /**
   * Check if a target node is within a subtree rooted at ancestor.
   * @private
   */
  _isNodeInSubtree(targetId, ancestorId) {
    if (targetId === ancestorId) {
      return true;
    }
    const children = this.graph.getChildren(ancestorId);
    for (const childId of children) {
      if (this._isNodeInSubtree(targetId, childId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a node has any abbreviated (abbreviated-projected) children.
   * Used to distinguish "collapsed node with abbreviated children" from "ordinarily collapsed node".
   * @private
   * @param {string} nodeId - The node to check
   * @returns {boolean} True if the node is a source of any abbreviated link
   */
  _hasAbbreviatedChildren(nodeId) {
    const abbreviatedLinks = this.projection.getAbbreviatedLinks();
    for (const link of abbreviatedLinks) {
      if (link.sourceId === nodeId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a node has any ordinary visible biological children.
   * @private
   * @param {string} nodeId - The node to check
   * @returns {boolean} True if any immediate child is visible
   */
  _hasVisibleBiologicalChildren(nodeId) {
    const children = this.graph.getChildren(nodeId);
    for (const childId of children) {
      if (this.visibilityState.isNodeVisible(childId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Refresh the visualization with current visibility state.
   * Uses TreeDisplayProjection to obtain the current display projection,
   * then updates the visualization renderer.
   * Updates visible nodes/links and refreshes the D3 simulation.
   * @private
   */
  _refreshVisualization() {
    if (!this.visualization) {
      return;
    }

    // Regenerate projection to reflect latest visibility state
    this.projection.regenerate();

    // Get current visibility from projection
    const visibleNodeIds = this.projection.getVisibleNodeIds();

    // Get abbreviated links from projection for display
    const abbreviatedLinks = this.projection.getAbbreviatedLinks();

    // Update visualization to show only visible nodes and links
    if (typeof this.visualization.updateVisibility === 'function' && this.allNodes && this.allLinks) {
      this.visualization.updateVisibility(visibleNodeIds, this.allNodes, this.allLinks, abbreviatedLinks);
    }
  }

  /**
   * Set whether dragging is in progress (to prevent clicks during drags).
   * @param {boolean} isDragging
   */
  setDragging(isDragging) {
    this.isDragging = isDragging;
  }

  /**
   * Check if a node should appear as clickable/expandable.
   * @param {Object} nodeData - Visualization node data
   * @returns {boolean}
   */
  isClickableNode(nodeData) {
    // Only internal nodes (those with children) are clickable
    return nodeData.children && nodeData.children.length > 0;
  }
}

export { TreeManipulation };
