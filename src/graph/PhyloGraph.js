/**
 * PhyloGraph - Immutable Phylogenetic Graph Structure
 * Represents a rooted phylogenetic tree with read-only operations.
 * All modifications occur during the build phase; the finalized graph is immutable.
 */

class PhyloGraph {
  constructor(hypothesisId, rootNodeId, nodeMap, edgeMap, taxonomy = {}) {
    this.hypothesisId = hypothesisId;
    this.rootNodeId = rootNodeId;
    // Deep copy nodeMap to prevent external mutations
    this.nodeMap = new Map();
    for (const [key, value] of Object.entries(nodeMap)) {
      this.nodeMap.set(key, {
        ...value,
        children: value.children ? [...value.children] : value.children
      });
    }
    // Deep copy edgeMap to prevent external mutations
    this.edgeMap = new Map();
    for (const [key, value] of Object.entries(edgeMap)) {
      this.edgeMap.set(key, [...value]);
    }
    // Deep copy taxonomy to prevent external mutations
    this.taxonomy = {};
    for (const [taxonId, taxonData] of Object.entries(taxonomy)) {
      this.taxonomy[taxonId] = { ...taxonData };
    }
    this._parentCache = new Map();
    this._pathToRootCache = new Map();
    Object.freeze(this);
  }

  /**
   * Deep copy helper for defensive copying
   * @private
   * @param {object} obj
   * @returns {object} Deep copy of object with primitive properties
   */
  _deepCopyObject(obj) {
    if (obj === null || obj === undefined) return obj;
    const copy = {};
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        copy[key] = [...value];
      } else if (typeof value === 'object' && value !== null) {
        copy[key] = { ...value };
      } else {
        copy[key] = value;
      }
    }
    return copy;
  }

  /**
   * Get the parent of a node
   * @param {string} nodeId
   * @returns {string|null} Parent node ID, or null if node is root
   */
  getParent(nodeId) {
    if (!this.nodeMap.has(nodeId)) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    const node = this.nodeMap.get(nodeId);
    return node.parentId || null;
  }

  /**
   * Get children of a node
   * @param {string} nodeId
   * @returns {string[]} Array of child node IDs
   */
  getChildren(nodeId) {
    if (!this.nodeMap.has(nodeId)) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    return [...(this.edgeMap.get(nodeId) || [])];
  }

  /**
   * Get the path from a node to the root
   * @param {string} nodeId
   * @returns {string[]} Array of node IDs from node to root (inclusive)
   */
  getPathToRoot(nodeId) {
    if (this._pathToRootCache.has(nodeId)) {
      return [...this._pathToRootCache.get(nodeId)];
    }

    if (!this.nodeMap.has(nodeId)) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const path = [];
    let current = nodeId;

    while (current !== null) {
      path.push(current);
      if (current === this.rootNodeId) break;
      const node = this.nodeMap.get(current);
      current = node.parentId || null;
    }

    // Cache immutable copy
    this._pathToRootCache.set(nodeId, Object.freeze([...path]));
    return [...path];
  }

  /**
   * Get all nodes
   * @returns {Map<string, object>} Map of node ID to node data (defensive copies)
   */
  getNodes() {
    const copy = new Map();
    for (const [nodeId, nodeData] of this.nodeMap) {
      copy.set(nodeId, this._deepCopyObject(nodeData));
    }
    return copy;
  }

  /**
   * Get a single node
   * @param {string} nodeId
   * @returns {object} Node data (defensive copy)
   */
  getNode(nodeId) {
    if (!this.nodeMap.has(nodeId)) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    return this._deepCopyObject(this.nodeMap.get(nodeId));
  }

  /**
   * Check if a node exists
   * @param {string} nodeId
   * @returns {boolean}
   */
  hasNode(nodeId) {
    return this.nodeMap.has(nodeId);
  }

  /**
   * Get the root node ID
   * @returns {string}
   */
  getRoot() {
    return this.rootNodeId;
  }

  /**
   * Get all terminal node IDs
   * @returns {string[]}
   */
  getTerminals() {
    return Array.from(this.nodeMap.values())
      .filter(node => node.type === 'terminal')
      .map(node => node.id);
  }

  /**
   * Get all internal node IDs
   * @returns {string[]}
   */
  getInternals() {
    return Array.from(this.nodeMap.values())
      .filter(node => node.type === 'internal')
      .map(node => node.id);
  }

  /**
   * Get the most recent common ancestor (MRCA) of two nodes
   * @param {string} nodeId1
   * @param {string} nodeId2
   * @returns {string} MRCA node ID
   */
  getMRCA(nodeId1, nodeId2) {
    if (!this.nodeMap.has(nodeId1)) {
      throw new Error(`Node not found: ${nodeId1}`);
    }
    if (!this.nodeMap.has(nodeId2)) {
      throw new Error(`Node not found: ${nodeId2}`);
    }

    const path1 = new Set(this.getPathToRoot(nodeId1));
    const path2 = this.getPathToRoot(nodeId2);

    for (const node of path2) {
      if (path1.has(node)) {
        return node;
      }
    }

    return this.rootNodeId;
  }

  /**
   * Get taxon for a terminal node
   * @param {string} terminalNodeId
   * @returns {object|null} Taxon object (defensive copy) or null if not found
   */
  getTaxonForTerminal(terminalNodeId) {
    const node = this.nodeMap.get(terminalNodeId);
    if (!node || node.type !== 'terminal') {
      throw new Error(`Not a terminal node: ${terminalNodeId}`);
    }

    const taxon = this.taxonomy[node.taxonId];
    return taxon ? this._deepCopyObject(taxon) : null;
  }

  /**
   * Validate tree integrity
   * @returns {object} Validation result with isValid boolean and errors array
   */
  validate() {
    const errors = [];

    // Check all nodes are reachable from root
    const visited = new Set();
    const dfs = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const children = this.edgeMap.get(nodeId) || [];
      for (const childId of children) {
        dfs(childId);
      }
    };
    dfs(this.rootNodeId);

    for (const nodeId of this.nodeMap.keys()) {
      if (!visited.has(nodeId)) {
        errors.push(`Node ${nodeId} is not reachable from root`);
      }
    }

    // Check no cycles
    const visitedPath = new Set();
    const checkCycles = (nodeId) => {
      if (visitedPath.has(nodeId)) {
        errors.push(`Cycle detected: ${nodeId}`);
        return;
      }
      visitedPath.add(nodeId);
      const parentId = this.nodeMap.get(nodeId)?.parentId;
      if (parentId) {
        checkCycles(parentId);
      }
      visitedPath.delete(nodeId);
    };

    for (const nodeId of this.nodeMap.keys()) {
      checkCycles(nodeId);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * GraphBuilder - Constructs PhyloGraph with validation
 * Mutable during construction; produces immutable PhyloGraph upon finalization.
 */
class GraphBuilder {
  constructor(hypothesisId, rootNodeId) {
    this.hypothesisId = hypothesisId;
    this.rootNodeId = rootNodeId;
    this.nodeMap = {};
    this.edgeMap = {};
  }

  /**
   * Add a node to the graph
   * @param {string} nodeId
   * @param {string} type - 'terminal' or 'internal'
   * @param {string|null} parentId
   * @param {object} node - Full node data
   */
  addNode(node) {
    if (this.nodeMap[node.id]) {
      throw new Error(`Duplicate node ID: ${node.id}`);
    }
    this.nodeMap[node.id] = node;

    // Initialize edge list if not exists
    if (!this.edgeMap[node.id]) {
      this.edgeMap[node.id] = [];
    }

    // Add to parent's edge list
    if (node.parentId && node.id !== this.rootNodeId) {
      if (!this.edgeMap[node.parentId]) {
        this.edgeMap[node.parentId] = [];
      }
      if (!this.edgeMap[node.parentId].includes(node.id)) {
        this.edgeMap[node.parentId].push(node.id);
      }
    }

    return this;
  }

  /**
   * Validate the graph structure
   * @throws {Error} If validation fails
   */
  validate() {
    // Check root exists
    if (!this.nodeMap[this.rootNodeId]) {
      throw new Error(`Root node not found: ${this.rootNodeId}`);
    }

    // Check all parents exist
    for (const nodeId in this.nodeMap) {
      const node = this.nodeMap[nodeId];
      if (node.parentId && !this.nodeMap[node.parentId]) {
        throw new Error(`Node '${nodeId}' references non-existent parent '${node.parentId}'`);
      }
    }

    // Check all children exist
    for (const nodeId in this.nodeMap) {
      const node = this.nodeMap[nodeId];
      if (node.children && Array.isArray(node.children)) {
        for (const childId of node.children) {
          if (!this.nodeMap[childId]) {
            throw new Error(`Node '${nodeId}' references non-existent child '${childId}'`);
          }
        }
      }
    }

    // Check tree structure
    const visited = new Set();
    const dfs = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const children = this.edgeMap[nodeId] || [];
      for (const childId of children) {
        dfs(childId);
      }
    };
    dfs(this.rootNodeId);

    for (const nodeId in this.nodeMap) {
      if (!visited.has(nodeId)) {
        throw new Error(`Node '${nodeId}' is not reachable from root`);
      }
    }

    return true;
  }

  /**
   * Build and return an immutable PhyloGraph
   * @param {object} taxonomy - Taxonomy data
   * @returns {PhyloGraph}
   */
  build(taxonomy = {}) {
    this.validate();
    return new PhyloGraph(
      this.hypothesisId,
      this.rootNodeId,
      this.nodeMap,
      this.edgeMap,
      taxonomy
    );
  }
}

export { PhyloGraph, GraphBuilder };
