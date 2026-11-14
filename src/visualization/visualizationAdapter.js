/**
 * Visualization Adapter
 *
 * Transforms an immutable PhyloGraph into independent, mutable visualization objects
 * suitable for D3 force simulation.
 *
 * CRITICAL: The adapter ensures that D3 mutations (to x, y, vx, vy, fx, fy, index, etc.)
 * never affect the underlying scientific graph or taxonomy data. This is achieved by
 * creating separate, deep copies of all visualization data.
 */

import { resolveDisplayName } from '../taxonomy/displayNameResolver.js';

class VisualizationAdapter {
  /**
   * Construct a visualization adapter from a PhyloGraph.
   *
   * @param {PhyloGraph} graph - The immutable phylogenetic graph
   * @param {Object} taxonomy - The taxonomy map (id -> taxon)
   * @param {Object} silhouetteMapping - Map of taxonId to silhouette filename (optional)
   */
  constructor(graph, taxonomy = {}, silhouetteMapping = null) {
    this.graph = graph;
    this.taxonomy = taxonomy;
    this.silhouetteMapping = silhouetteMapping || {};
    this.nodes = [];
    this.links = [];
    this.nodeMap = new Map(); // maps scientific node ID to visualization node
  }

  /**
   * Produce visualization nodes and links independent of the scientific graph.
   *
   * This creates fresh copies of all data, ensuring that D3 force simulation
   * mutations cannot affect the underlying graph or taxonomy.
   */
  adapt() {
    this.nodes = [];
    this.links = [];
    this.nodeMap.clear();

    // Get all nodes from the graph (returns a Map)
    const graphNodesMap = this.graph.getNodes();

    // Create visualization node objects (independent copies)
    for (const [nodeId, node] of graphNodesMap) {
      const vizNode = this._createVisualizationNode(nodeId, node);
      this.nodes.push(vizNode);
      this.nodeMap.set(nodeId, vizNode);
    }

    // Create visualization link objects
    for (const [nodeId, node] of graphNodesMap) {
      if (node.parentId && node.parentId !== null) {
        const parentNode = graphNodesMap.get(node.parentId);
        if (parentNode) {
          const link = this._createVisualizationLink(nodeId, node.parentId, parentNode);
          this.links.push(link);
        }
      }
    }

    return { nodes: this.nodes, links: this.links };
  }

  /**
   * Create an independent visualization node object.
   *
   * Contains:
   * - Stable reference back to scientific node ID (for tracing)
   * - Scientific node metadata (type, taxonId, etc.) - COPIED, not referenced
   * - Mutable layout properties (x, y, vx, vy, fx, fy) for D3 to modify
   * - Index for D3 simulation
   *
   * @private
   */
  _createVisualizationNode(nodeId, graphNode) {
    const vizNode = {
      // Stable reference to scientific data (immutable copy)
      id: nodeId,
      type: graphNode.type,
      parentId: graphNode.parentId ? String(graphNode.parentId) : null,
      taxonId: graphNode.taxonId ? String(graphNode.taxonId) : null,
      sourceLabel: graphNode.sourceLabel ? String(graphNode.sourceLabel) : null,

      // Age data (if available on the graph node - e.g., from Tetrapods hypothesis)
      age_ma: typeof graphNode.age_ma === 'number' && isFinite(graphNode.age_ma) ? graphNode.age_ma : undefined,

      // Get taxon name if this is a terminal node
      label: this._getNodeLabel(nodeId, graphNode),

      // Terminal species: common name and scientific name (for two-line labels)
      commonName: this._getCommonName(graphNode),
      scientificName: this._getScientificName(graphNode),

      // Silhouette asset for terminal species (if available)
      silhouetteFilename: this._getSilhouetteFilename(graphNode),
      silhouetteUrl: this._getSilhouetteUrl(graphNode),

      // Taxonomic metadata for ancestor nodes (if available)
      taxonomic_summary: this._copyTaxonomicSummary(graphNode),

      // Mutable layout properties (D3 will set these)
      x: Math.random() * 800,
      y: Math.random() * 600,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      index: undefined  // D3 sets this during simulation
    };

    return vizNode;
  }

  /**
   * Create an independent visualization link object.
   *
   * D3's forceLink() resolves source/target IDs to actual node objects using the .id() accessor.
   * We store node IDs here and D3 will resolve them to node references during force simulation.
   *
   * @private
   */
  _createVisualizationLink(childNodeId, parentNodeId, parentNode) {
    const link = {
      // Scientific node IDs (immutable reference, for validation/debugging)
      sourceId: parentNodeId,
      targetId: childNodeId,

      // D3 forceLink uses source/target IDs to resolve node references
      // The .id() accessor in forceLink will match these against node.id
      source: parentNodeId,
      target: childNodeId
    };

    return link;
  }

  /**
   * Get a human-readable label for a node.
   *
   * Uses resolveDisplayName for taxonomy-aware naming.
   * Falls back to ancestor labels for internal nodes without taxon association.
   *
   * @private
   */
  _getNodeLabel(nodeId, graphNode) {
    // Try to resolve from taxonomy using the resolver
    const displayName = resolveDisplayName(graphNode, this.taxonomy, { preferCommonName: false });

    // If resolver returned a generic "Unidentified node", generate ancestor label
    if (displayName === 'Unidentified node') {
      const idStr = String(nodeId || '');
      const match = idStr.match(/_n(\d+)$/);
      if (match) {
        return `Ancestor ${match[1]}`;
      }
      return idStr;
    }

    return displayName;
  }

  /**
   * Get common name for a node.
   * Works for any node with a valid taxonId (terminal or internal).
   * @private
   */
  _getCommonName(graphNode) {
    if (graphNode.taxonId) {
      const taxon = this.taxonomy[graphNode.taxonId];
      if (taxon) {
        return taxon.commonName || null;
      }
    }
    return null;
  }

  /**
   * Get scientific name for a node.
   * Works for any node with a valid taxonId (terminal or internal).
   * @private
   */
  _getScientificName(graphNode) {
    if (graphNode.taxonId) {
      const taxon = this.taxonomy[graphNode.taxonId];
      if (taxon) {
        return taxon.scientificName || null;
      }
    }
    return null;
  }

  /**
   * Get silhouette filename for a node.
   * Works for any node with a valid taxonId (terminal or internal).
   * @private
   */
  _getSilhouetteFilename(graphNode) {
    if (graphNode.taxonId) {
      const mapping = this.silhouetteMapping[graphNode.taxonId];
      if (mapping && mapping.silhouetteFilename) {
        return mapping.silhouetteFilename;
      }
    }
    return null;
  }

  /**
   * Copy taxonomic_summary from graph node if present.
   * Returns a shallow copy to ensure independence from the source object.
   * @private
   */
  _copyTaxonomicSummary(graphNode) {
    if (graphNode.taxonomic_summary && typeof graphNode.taxonomic_summary === 'object') {
      // Shallow copy: all properties (name, rank, method, source, descendant_species_count) are primitives
      return Object.assign({}, graphNode.taxonomic_summary);
    }
    return undefined;
  }

  /**
   * Get silhouette URL for a node (for PhyloPic images).
   * Works for any node with a valid taxonId (terminal or internal).
   * @private
   */
  _getSilhouetteUrl(graphNode) {
    if (graphNode.taxonId) {
      const mapping = this.silhouetteMapping[graphNode.taxonId];
      if (mapping && mapping.silhouetteUrl) {
        return mapping.silhouetteUrl;
      }
    }
    return null;
  }

  /**
   * Get the count of terminal (species) nodes.
   */
  getTerminalCount() {
    return this.nodes.filter(n => n.type === 'terminal').length;
  }

  /**
   * Get the count of internal (ancestral) nodes.
   */
  getInternalCount() {
    return this.nodes.filter(n => n.type === 'internal').length;
  }

  /**
   * Get a visualization node by its scientific ID.
   */
  getNodeById(scientificId) {
    return this.nodeMap.get(scientificId);
  }

  /**
   * Verify immutability: get a deep copy of current visualization state.
   * (Used for testing that mutations don't affect the original.)
   */
  snapshotVisualizationState() {
    return {
      nodes: this.nodes.map(n => JSON.parse(JSON.stringify(n))),
      links: this.links.map(l => JSON.parse(JSON.stringify(l)))
    };
  }
}

export { VisualizationAdapter };
