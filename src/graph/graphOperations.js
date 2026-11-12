/**
 * Graph Operations
 * Core algorithms for working with phylogenetic graphs.
 * All operations work on immutable graphs and never modify the original.
 */

import { GraphBuilder } from './PhyloGraph.js';

/**
 * Find the most recent common ancestor (MRCA) of two taxa
 * @param {PhyloGraph} graph
 * @param {string} taxonId1
 * @param {string} taxonId2
 * @returns {string} MRCA node ID
 */
export function findMRCA(graph, taxonId1, taxonId2) {
  if (!graph.hasNode(taxonId1)) {
    throw new Error(`Node not found: ${taxonId1}`);
  }
  if (!graph.hasNode(taxonId2)) {
    throw new Error(`Node not found: ${taxonId2}`);
  }

  return graph.getMRCA(taxonId1, taxonId2);
}

/**
 * Get path from one node to another via their MRCA
 * @param {PhyloGraph} graph
 * @param {string} fromNodeId
 * @param {string} toNodeId
 * @returns {object} Path information with nodeIds and direction
 */
export function getPathBetween(graph, fromNodeId, toNodeId) {
  if (!graph.hasNode(fromNodeId)) {
    throw new Error(`Node not found: ${fromNodeId}`);
  }
  if (!graph.hasNode(toNodeId)) {
    throw new Error(`Node not found: ${toNodeId}`);
  }

  const mrca = graph.getMRCA(fromNodeId, toNodeId);
  const pathUp = graph.getPathToRoot(fromNodeId);
  const pathDown = graph.getPathToRoot(toNodeId);

  // Find index of MRCA in each path
  const mrcaUpIdx = pathUp.indexOf(mrca);
  const mrcaDownIdx = pathDown.indexOf(mrca);

  // Construct full path: from -> ... -> MRCA -> ... -> to
  const upToMrca = pathUp.slice(0, mrcaUpIdx + 1);
  const downFromMrca = pathDown.slice(0, mrcaDownIdx).reverse();

  return {
    mrca,
    path: [...upToMrca, ...downFromMrca],
    nodes: {
      from: fromNodeId,
      mrca,
      to: toNodeId
    }
  };
}

/**
 * Get all descendants of a node
 * @param {PhyloGraph} graph
 * @param {string} nodeId
 * @returns {string[]} Array of descendant node IDs (not including the node itself)
 */
export function getDescendants(graph, nodeId) {
  if (!graph.hasNode(nodeId)) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const descendants = [];
  const stack = [nodeId];
  const visited = new Set();

  while (stack.length > 0) {
    const current = stack.pop();
    if (visited.has(current)) continue;
    visited.add(current);

    const children = graph.getChildren(current);
    for (const child of children) {
      if (child !== nodeId) {
        descendants.push(child);
        stack.push(child);
      }
    }
  }

  return descendants;
}

/**
 * Build a pruned graph containing only specified nodes and their necessary ancestors
 * The original graph is not modified; a new graph is returned.
 * @param {PhyloGraph} originalGraph
 * @param {string[]} bookmarkedNodeIds - Nodes to keep
 * @returns {PhyloGraph} New pruned graph with independent data
 */
export function buildPrunedGraph(originalGraph, bookmarkedNodeIds) {
  if (bookmarkedNodeIds.length === 0) {
    throw new Error('At least one bookmarked node must be specified');
  }

  // Validate all bookmarked nodes exist
  for (const nodeId of bookmarkedNodeIds) {
    if (!originalGraph.hasNode(nodeId)) {
      throw new Error(`Bookmarked node not found: ${nodeId}`);
    }
  }

  // Find all ancestors of bookmarked nodes
  const nodesToKeep = new Set(bookmarkedNodeIds);

  for (const nodeId of bookmarkedNodeIds) {
    const pathToRoot = originalGraph.getPathToRoot(nodeId);
    for (const ancestorId of pathToRoot) {
      nodesToKeep.add(ancestorId);
    }
  }

  // Build new graph with only these nodes
  const builder = new GraphBuilder(originalGraph.hypothesisId, originalGraph.rootNodeId);

  // Add nodes in topological order (root first)
  const nodesToAdd = Array.from(nodesToKeep);
  nodesToAdd.sort((a, b) => {
    const depthA = originalGraph.getPathToRoot(a).length;
    const depthB = originalGraph.getPathToRoot(b).length;
    return depthB - depthA; // Process root first (deeper path = closer to root)
  });

  for (const nodeId of nodesToAdd) {
    const originalNode = originalGraph.getNode(nodeId);
    const children = originalGraph.getChildren(nodeId);
    const retainedChildren = children.filter(childId => nodesToKeep.has(childId));

    // Create node with only retained children
    const prunedNode = {
      ...originalNode,
      children: retainedChildren
    };

    builder.addNode(prunedNode);
  }

  // Deep copy taxonomy to ensure pruned and original graphs do not share mutable data
  const taxonomyCopy = {};
  const originalTaxonomy = originalGraph.taxonomy || {};
  for (const [taxonId, taxonData] of Object.entries(originalTaxonomy)) {
    taxonomyCopy[taxonId] = { ...taxonData };
  }

  return builder.build(taxonomyCopy);
}

/**
 * Validate tree integrity
 * @param {PhyloGraph} graph
 * @returns {object} Validation result { isValid, errors }
 */
export function validateTree(graph) {
  return graph.validate();
}

/**
 * Get all terminal taxa in the graph
 * @param {PhyloGraph} graph
 * @returns {object[]} Array of terminal node objects
 */
export function getTerminalTaxa(graph) {
  return graph.getTerminals().map(terminalId => graph.getNode(terminalId));
}

/**
 * Get all internal nodes in the graph
 * @param {PhyloGraph} graph
 * @returns {object[]} Array of internal node objects
 */
export function getInternalNodes(graph) {
  return graph.getInternals().map(internalId => graph.getNode(internalId));
}

/**
 * Get subtree rooted at a node
 * @param {PhyloGraph} graph
 * @param {string} nodeId
 * @returns {PhyloGraph} New pruned graph containing only subtree
 */
export function getSubtree(graph, nodeId) {
  if (!graph.hasNode(nodeId)) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const descendants = getDescendants(graph, nodeId);
  const subtreeNodes = [nodeId, ...descendants];

  return buildPrunedGraph(graph, subtreeNodes);
}

/**
 * Get all leaves of a node (terminal descendants)
 * @param {PhyloGraph} graph
 * @param {string} nodeId
 * @returns {string[]} Array of terminal node IDs under this node
 */
export function getLeaves(graph, nodeId) {
  if (!graph.hasNode(nodeId)) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const leaves = [];
  const stack = [nodeId];
  const visited = new Set();

  while (stack.length > 0) {
    const current = stack.pop();
    if (visited.has(current)) continue;
    visited.add(current);

    const node = graph.getNode(current);
    if (node.type === 'terminal') {
      leaves.push(current);
    } else {
      const children = graph.getChildren(current);
      for (const child of children) {
        stack.push(child);
      }
    }
  }

  return leaves;
}

/**
 * Check if node1 is an ancestor of node2
 * @param {PhyloGraph} graph
 * @param {string} potentialAncestorId
 * @param {string} nodeId
 * @returns {boolean}
 */
export function isAncestorOf(graph, potentialAncestorId, nodeId) {
  if (!graph.hasNode(potentialAncestorId) || !graph.hasNode(nodeId)) {
    return false;
  }

  const pathToRoot = graph.getPathToRoot(nodeId);
  return pathToRoot.includes(potentialAncestorId);
}

/**
 * Get tree depth (maximum distance from root)
 * @param {PhyloGraph} graph
 * @returns {number}
 */
export function getTreeDepth(graph) {
  let maxDepth = 0;
  for (const nodeId of graph.getNodes().keys()) {
    const depth = graph.getPathToRoot(nodeId).length - 1;
    maxDepth = Math.max(maxDepth, depth);
  }
  return maxDepth;
}

/**
 * Get tree size (node count)
 * @param {PhyloGraph} graph
 * @returns {number}
 */
export function getTreeSize(graph) {
  return graph.getNodes().size;
}
