/**
 * TreeVisibilityState - Manages node and link visibility for tree collapse/expansion
 *
 * Provides a separate visibility-state mechanism that determines which original
 * visualization nodes and links should currently be displayed. The underlying
 * PhyloGraph and node metadata remain unchanged.
 *
 * Initial state: every node is visible, preserving the existing visualization exactly.
 *
 * Collapsing an internal node hides all its descendants while retaining the selected node.
 * Expanding one level reveals immediate children only.
 */

class TreeVisibilityState {
  /**
   * Construct a visibility state for a phylogenetic graph.
   *
   * @param {PhyloGraph} graph - The immutable phylogenetic graph
   */
  constructor(graph) {
    this.graph = graph;
    this.rootNodeId = graph.rootNodeId;

    // Track which nodes are currently visible
    // Initially, all nodes are visible
    this.visibleNodeIds = new Set();
    for (const [nodeId] of graph.getNodes()) {
      this.visibleNodeIds.add(nodeId);
    }

    // Track which nodes are collapsed
    // A collapsed node keeps itself visible but hides all descendants
    this.collapsedNodeIds = new Set();
  }

  /**
   * Get all currently visible node IDs.
   * @returns {Set<string>} Set of visible node IDs
   */
  getVisibleNodeIds() {
    return new Set(this.visibleNodeIds);
  }

  /**
   * Get all currently visible link IDs (as [sourceId, targetId] pairs).
   * Links only exist between visible nodes whose original parent-child relationship is direct.
   * @returns {Array<[string, string]>} Array of [parentId, childId] pairs
   */
  getVisibleLinkIds() {
    const visibleLinks = [];

    for (const childId of this.visibleNodeIds) {
      const parent = this.graph.getParent(childId);
      // If the child's parent is also visible, this is a visible link
      if (parent && this.visibleNodeIds.has(parent)) {
        visibleLinks.push([parent, childId]);
      }
    }

    return visibleLinks;
  }

  /**
   * Check if a node is currently visible.
   * @param {string} nodeId
   * @returns {boolean}
   */
  isNodeVisible(nodeId) {
    return this.visibleNodeIds.has(nodeId);
  }

  /**
   * Check if a node is currently collapsed.
   * @param {string} nodeId
   * @returns {boolean}
   */
  isNodeCollapsed(nodeId) {
    return this.collapsedNodeIds.has(nodeId);
  }

  /**
   * Collapse an internal node: hide all its descendants while retaining the selected node.
   * If the node is already collapsed, this is a no-op.
   * If the node is the root, collapse it (hiding all descendants).
   *
   * @param {string} nodeId - Node to collapse
   * @throws {Error} if node does not exist
   */
  collapseNode(nodeId) {
    if (!this.graph.getNodes().has(nodeId)) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Mark as collapsed (if not already)
    if (this.collapsedNodeIds.has(nodeId)) {
      return; // Already collapsed
    }

    this.collapsedNodeIds.add(nodeId);

    // Hide all descendants of this node
    this._hideDescendants(nodeId);
  }

  /**
   * Expand a collapsed node one level: reveal its immediate children.
   * Do not automatically reveal their descendants.
   * Newly revealed internal children are marked as collapsed.
   * Terminal children are not marked as collapsed (they have no descendants).
   * If the node is not collapsed, this is a no-op.
   * If the node is not currently visible, this is a no-op (prevents revealing children of hidden nodes).
   *
   * @param {string} nodeId - Node to expand one level
   * @throws {Error} if node does not exist
   */
  expandNodeOneLevel(nodeId) {
    if (!this.graph.getNodes().has(nodeId)) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // If node is not visible, do nothing (never reveal children of hidden nodes)
    if (!this.visibleNodeIds.has(nodeId)) {
      return;
    }

    // If not collapsed, nothing to do
    if (!this.collapsedNodeIds.has(nodeId)) {
      return;
    }

    // Mark as expanded
    this.collapsedNodeIds.delete(nodeId);

    // Make immediate children visible and mark newly revealed internal children as collapsed
    const children = this.graph.getChildren(nodeId);
    for (const childId of children) {
      this.visibleNodeIds.add(childId);

      // Check if this child is internal (has children of its own)
      const childChildren = this.graph.getChildren(childId);
      if (childChildren.length > 0) {
        // It's an internal node; mark it as collapsed so it can be expanded independently
        this.collapsedNodeIds.add(childId);
      }
      // Terminal nodes are not marked as collapsed (they have no descendants to expand)
    }
  }

  /**
   * Collapse the entire tree to show only the root node.
   * The root is marked as collapsed so it can be expanded.
   * Internal nodes with children are marked collapsed so they can be expanded when visible.
   * Terminal nodes are not marked collapsed (they have no children to expand).
   */
  collapseToRoot() {
    // Hide all non-root nodes
    const allNodeIds = [];
    for (const nodeId of this.graph.getNodes().keys()) {
      allNodeIds.push(nodeId);
    }

    for (const nodeId of allNodeIds) {
      if (nodeId !== this.rootNodeId) {
        this.visibleNodeIds.delete(nodeId);
      }
    }

    // Mark root and all hidden internal nodes with children as collapsed
    this.collapsedNodeIds.clear();
    this.collapsedNodeIds.add(this.rootNodeId); // Root is collapsed

    for (const nodeId of allNodeIds) {
      if (nodeId !== this.rootNodeId) {
        // Check if this hidden node is internal (has children)
        const children = this.graph.getChildren(nodeId);
        if (children.length > 0) {
          // It's an internal node, mark it collapsed so it can be expanded later
          this.collapsedNodeIds.add(nodeId);
        }
        // Terminal nodes (no children) are not marked collapsed
      }
    }
  }

  /**
   * Expand the root node one level to show its immediate children.
   */
  expandRootOneLevel() {
    // Mark root as expanded
    this.collapsedNodeIds.delete(this.rootNodeId);

    // Make immediate children of root visible
    const rootChildren = this.graph.getChildren(this.rootNodeId);
    for (const childId of rootChildren) {
      this.visibleNodeIds.add(childId);
    }
  }

  /**
   * Reset to initial state: show all nodes, none collapsed.
   */
  resetToAllVisible() {
    this.visibleNodeIds.clear();
    this.collapsedNodeIds.clear();

    for (const nodeId of this.graph.getNodes().keys()) {
      this.visibleNodeIds.add(nodeId);
    }
  }

  /**
   * Hide all descendants of a node (recursively).
   * @private
   */
  _hideDescendants(nodeId) {
    const children = this.graph.getChildren(nodeId);
    for (const childId of children) {
      this.visibleNodeIds.delete(childId);
      // Recursively hide descendants of this child
      this._hideDescendants(childId);
    }
  }

  /**
   * Get the number of visible nodes.
   * @returns {number}
   */
  getVisibleNodeCount() {
    return this.visibleNodeIds.size;
  }

  /**
   * Get the number of visible links.
   * @returns {number}
   */
  getVisibleLinkCount() {
    return this.getVisibleLinkIds().length;
  }

  /**
   * Get the immediate children of a node that are currently visible.
   * @param {string} nodeId
   * @returns {string[]} Array of visible child node IDs
   */
  getVisibleChildren(nodeId) {
    const allChildren = this.graph.getChildren(nodeId);
    return allChildren.filter(childId => this.visibleNodeIds.has(childId));
  }

  /**
   * Get all descendants of a node (recursively) that are currently visible.
   * @param {string} nodeId
   * @returns {string[]} Array of visible descendant node IDs
   */
  getVisibleDescendants(nodeId) {
    const descendants = [];
    const toVisit = [nodeId];

    while (toVisit.length > 0) {
      const current = toVisit.shift();
      const children = this.graph.getChildren(current);

      for (const childId of children) {
        if (this.visibleNodeIds.has(childId)) {
          descendants.push(childId);
          toVisit.push(childId);
        }
      }
    }

    return descendants;
  }

  /**
   * Snapshot the current visibility state for testing/debugging.
   * @returns {Object} Object with visibleNodeIds and collapsedNodeIds
   */
  snapshotVisibilityState() {
    return {
      visibleNodeIds: new Set(this.visibleNodeIds),
      collapsedNodeIds: new Set(this.collapsedNodeIds)
    };
  }

  /**
   * Check if the visible topology is valid: every visible non-root node has a visible parent.
   * Used for testing/validation only.
   * @returns {boolean} True if valid
   */
  isVisibleTopologyValid() {
    for (const nodeId of this.visibleNodeIds) {
      if (nodeId === this.rootNodeId) {
        continue; // Root has no parent
      }

      const parent = this.graph.getParent(nodeId);
      if (!parent || !this.visibleNodeIds.has(parent)) {
        return false; // Visible node with invisible parent
      }
    }

    return true;
  }
}

export { TreeVisibilityState };
