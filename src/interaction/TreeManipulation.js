/**
 * TreeManipulation - Handles click interactions for tree collapse/expand operations
 *
 * Manages user interactions with phylogenetic tree nodes:
 * - Normal click: expand one level
 * - Shift-click: expand entire subtree
 * - Alt-click: collapse or random sampling
 *
 * Reuses existing TreeVisibilityState engine and visualization refresh mechanism.
 */

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
      maxSampledSpecies: 10,  // Maximum terminal species in random sampling
      ...options
    };

    // Current interaction state
    this.isDragging = false;
  }

  /**
   * Handle a click event on a node.
   * Route to appropriate handler based on modifier keys and node type.
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
    if (event.shiftKey) {
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
   * Shift-click: expand entire descendant subtree (all descendants become visible).
   * Preserve original topology.
   * @private
   */
  _handleShiftClick(nodeId) {
    // Make the node itself visible if not already
    if (!this.visibilityState.isNodeVisible(nodeId)) {
      return;  // Can't expand hidden nodes
    }

    // Mark node as not collapsed
    if (this.visibilityState.isNodeCollapsed(nodeId)) {
      this.visibilityState.collapsedNodeIds.delete(nodeId);
    }

    // Recursively expand all descendants
    this._expandAllDescendants(nodeId);
  }

  /**
   * Alt-click behavior depends on node state:
   * - On expanded node: collapse all descendants
   * - On collapsed node: show random sample of terminal descendants
   * - On root: collapse entire tree
   * @private
   */
  _handleAltClick(nodeId) {
    if (nodeId === this.visibilityState.rootNodeId) {
      // Alt-click on root: collapse entire tree
      this.visibilityState.collapseToRoot();
      return;
    }

    if (this.visibilityState.isNodeCollapsed(nodeId)) {
      // Alt-click on collapsed node: show random sample
      this._showRandomSample(nodeId);
    } else {
      // Alt-click on expanded node: collapse all descendants
      this.visibilityState.collapseNode(nodeId);
    }
  }

  /**
   * Collapse Entire Tree operation: call the visibility engine's collapseToRoot.
   */
  collapseEntireTree() {
    this.visibilityState.collapseToRoot();
    this._refreshVisualization();
  }

  /**
   * Set the maximum number of terminal species shown in random sampling.
   * @param {number} max - Maximum species count (1-50 range recommended)
   */
  setMaxSampledSpecies(max) {
    this.options.maxSampledSpecies = Math.max(1, Math.min(max, 50));
  }

  /**
   * Expand all descendants recursively (for Shift-click).
   * @private
   */
  _expandAllDescendants(nodeId) {
    const children = this.graph.getChildren(nodeId);
    for (const childId of children) {
      // Make child visible
      this.visibilityState.visibleNodeIds.add(childId);

      // Mark child as not collapsed if it was
      if (this.visibilityState.isNodeCollapsed(childId)) {
        this.visibilityState.collapsedNodeIds.delete(childId);
      }

      // Recursively expand this child's descendants
      this._expandAllDescendants(childId);
    }
  }

  /**
   * Show a random sample of terminal descendants (for Alt-click on collapsed node).
   * Selects up to maxSampledSpecies terminals randomly from across branches.
   * @private
   */
  _showRandomSample(nodeId) {
    // Collect all terminal descendants
    const terminals = this._getTerminalDescendants(nodeId);

    if (terminals.length === 0) {
      return;  // No terminals to sample
    }

    // Select random sample
    const sampleSize = Math.min(terminals.length, this.options.maxSampledSpecies);
    const sampledTerminals = this._randomSample(terminals, sampleSize);

    // For each sampled terminal, make visible all ancestors up to nodeId
    for (const terminalId of sampledTerminals) {
      this._makePathVisible(terminalId, nodeId);
    }

    // Mark the node as no longer collapsed (it's now showing sampled descendants)
    this.visibilityState.collapsedNodeIds.delete(nodeId);
  }

  /**
   * Get all terminal descendants of a node.
   * @private
   * @returns {string[]} Array of terminal node IDs
   */
  _getTerminalDescendants(nodeId) {
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
   * Select a random sample from an array.
   * @private
   */
  _randomSample(array, size) {
    if (size >= array.length) {
      return [...array];
    }

    const result = [];
    const indices = new Set();

    while (indices.size < size) {
      const idx = Math.floor(Math.random() * array.length);
      indices.add(idx);
    }

    for (const idx of indices) {
      result.push(array[idx]);
    }

    return result;
  }

  /**
   * Make a path from terminal to ancestor visible.
   * Shows the terminal and all ancestors up to (but not including) the stopping node.
   * @private
   */
  _makePathVisible(terminalId, stoppingNodeId) {
    let current = terminalId;

    while (current && current !== stoppingNodeId) {
      this.visibilityState.visibleNodeIds.add(current);

      // Mark as not collapsed since we're revealing it
      if (this.visibilityState.isNodeCollapsed(current)) {
        this.visibilityState.collapsedNodeIds.delete(current);
      }

      const parent = this.graph.getParent(current);
      current = parent;
    }
  }

  /**
   * Refresh the visualization with current visibility state.
   * Updates visible nodes/links and refreshes the D3 simulation.
   * @private
   */
  _refreshVisualization() {
    if (!this.visualization) {
      return;
    }

    // Get current visibility state
    const visibleNodeIds = this.visibilityState.getVisibleNodeIds();

    // Update visualization to show only visible nodes and links
    if (typeof this.visualization.updateVisibility === 'function' && this.allNodes && this.allLinks) {
      this.visualization.updateVisibility(visibleNodeIds, this.allNodes, this.allLinks);
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
