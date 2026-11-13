/**
 * Force-Directed Graph Visualization
 * 
 * Renders an immutable PhyloGraph using D3.js force simulation.
 * All visualization state (node positions, velocities, etc.) is kept separate
 * from the scientific graph data.
 */

// Get d3 from global scope (loaded from CDN in browser)
let d3;

class ForceDirectedVisualization {
  /**
   * Initialize the force-directed visualization.
   * 
   * @param {string} containerId - ID of the HTML container element
   * @param {Array} nodes - Visualization node objects
   * @param {Array} links - Visualization link objects
   * @param {Object} options - Configuration options
   */
  constructor(containerId, nodes, links, options = {}) {
    // Initialize d3 reference if not already done
    if (!d3) {
      if (typeof window !== 'undefined' && window.d3) {
        d3 = window.d3;
      } else {
        throw new Error(
          'D3 is not available. In browser, ensure d3 is loaded from CDN before this script. ' +
          'In Node.js/tests, d3 must be imported separately.'
        );
      }
    }
    
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.nodes = nodes;
    this.links = links;
    
    // Default options
    this.options = {
      width: this.container?.clientWidth || 1000,
      height: this.container?.clientHeight || 800,
      chargeStrength: -300,
      linkStrength: 0.5,
      rootNodeId: null,
      assetMetadata: {},  // Asset source metadata
      ...options
    };

    // D3 simulation state
    this.simulation = null;
    this.svg = null;
    this.g = null;
    this.linkElements = null;
    this.nodeElements = null;
    this.nodeCircles = null;
    this.labelElements = null;
    this.scientificLabelElements = null;
    this.zoom = null;

    // Current force parameters
    this.currentChargeStrength = this.options.chargeStrength;
    this.currentLinkStrength = this.options.linkStrength;
    this.currentRootLinkStrength = 0;  // Root-proximity modifier (UI 0-1000, internal 0-10 via /100 in _computePerLinkStrength)
    this.currentAgeLinkStrength = 0;   // Age-based modifier (UI 0-100, produces per-Ma coefficient via /1000 in _computePerLinkStrength)
    
    // Topology repulsion equation: F_topology = B * (A + X) / D
    // Internal values are 0-10; UI values are 0-100 (divided by 10 when setting)
    this.topologyRepulsionX = 0;  // Master control strength (internal: 0, UI: 0 disables)
    this.topologyRepulsionA = 1;  // Baseline offset parameter (internal: 1, UI: 10)
    this.topologyRepulsionB = 1;  // Overall force scale multiplier (internal: 1, UI: 10)

    // Node depth cache for root link strength calculations
    this.nodeDepths = {};   // Map of nodeId to depth from root
    this.maxDepth = 0;      // Maximum depth (for normalization)

    // Root positioning
    this.lockRootPosition = true;

    // Directional wind force
    this.windDirection = 0; // Degrees: 0 = right
    this.windStrength = 0;  // UI range 0-2000
    this.windForce = null;

    // Appearance parameters
    this.backgroundWhiteLevel = 0;  // 0-100 blend from light blue to white
    this.edgeThickness = 1.5;
    this.nodeCircleScale = 1.0;
    this.fontSizeBase = 11;

    // Silhouette offsets (in pixels, relative to node center)
    this.silhouetteXOffset = 0;
    this.silhouetteYOffset = 0;
    this.silhouetteSizePercent = 100;  // Size as percentage of default (100 = 5x node radius)
    this.silhouetteOpacity = 1.0;  // Opacity (0-1)
    this.silhouetteGrayscale = 50;  // Grayscale (0=black, 50=gray, 100=white)

    // Grid parameters
    this.showGrid = true;
    this.gridSpacing = 50;  // Distance between minor grid lines in pixels
    this.gridMinorLineWidth = 0.5;  // Width of ordinary grid lines
    this.gridMediumLineWidth = 1.0;  // Width of every fifth line
    this.gridMajorLineWidth = 1.5;  // Width of every tenth line
    this.gridOpacity = 0.3;  // Opacity of grid (0-1)
    this.gridElement = null;  // SVG group containing grid lines

    // Node date display
    this.showNodeDates = false;
    this.divergenceData = this.options.divergenceData || null;  // Can be set during construction or later
    this.hypothesisId = this.options.hypothesisId || null;  // The active hypothesis ID for data lookups (passed independently of display toggles)
    this.nodeDateLabels = null;

    // Ancestral labels display
    this.showAncestralLabels = false;
    this.hypothesisData = null;
    this.phyloGraph = null;  // Store graph for label generation and topology repulsion
    this.ancestralLabelElements = null;
    this.rootNodeId = this.options.rootNodeId;

    // Topology-aware repulsion
    this.graphDistances = null;  // Precomputed shortest-path distances
    this.topoRepulsionForce = null;
    
    // Asset metadata for diagnostics
    this.assetMetadata = this.options.assetMetadata;

    // Initialize phyloGraph and compute distances if provided
    if (this.options.phyloGraph) {
      this._initializeGraphAndCache(this.options.phyloGraph);
    }
  }

  /**
   * Initialize the phyloGraph and precompute distance cache.
   * Called during construction if phyloGraph is provided in options,
   * or when setShowAncestralLabels receives a new graph.
   * 
   * @param {PhyloGraph} phyloGraph - The scientific phylogenetic graph
   * @throws {Error} If graph is invalid
   * @private
   */
  _initializeGraphAndCache(phyloGraph) {
    // Validate graph
    if (!phyloGraph) {
      console.warn('[ForceDirectedVisualization] No phyloGraph provided for topology repulsion initialization');
      this.phyloGraph = null;
      this.graphDistances = null;
      return;
    }

    if (typeof phyloGraph.getNodes !== 'function') {
      console.error('[ForceDirectedVisualization] Invalid phyloGraph: missing getNodes() method');
      this.phyloGraph = null;
      this.graphDistances = null;
      return;
    }

    // Store the graph
    this.phyloGraph = phyloGraph;

    // Compute and cache distances
    try {
      this.graphDistances = this._computeGraphDistances(phyloGraph);
      console.log(`[ForceDirectedVisualization] Graph distances computed for ${Object.keys(this.graphDistances).length} nodes`);
    } catch (error) {
      console.error('[ForceDirectedVisualization] Failed to compute graph distances:', error.message);
      this.graphDistances = null;
    }
  }

  /**
   * Render the visualization.
   */
  render() {
    if (!this.container) {
      throw new Error(`Container with ID '${this.containerId}' not found`);
    }

    // Clear any existing SVG
    d3.select(`#${this.containerId}`).selectAll('svg').remove();

    // Create SVG with light blue background
    this.svg = d3.select(`#${this.containerId}`)
      .append('svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height)
      .attr('style', 'border: 1px solid #ccc; background: #e8f4f8;');

    // Add a group for the graph content (for panning)
    this.g = this.svg.append('g');

    // Render grid as the first element in this.g so it appears behind everything
    this._renderGrid();

    // Compute node depths for root link strength modifiers
    this.nodeDepths = this._computeNodeDepths();
    this.maxDepth = Math.max(0, ...Object.values(this.nodeDepths));

    // Create force simulation
    this._createSimulation();

    // Add zoom behavior
    this._addZoomBehavior();

    // Render graph elements
    this._renderLinks();
    this._renderNodes();
    this._renderLabels();
    this._renderRootLabel();
    this._renderDateLabels();
    this._renderAncestralLabels();

    // Start simulation
    this.simulation.on('tick', () => this._onTick());

    return this;
  }

  /**
   * Create the D3 force simulation.
   * @private
   */
  _createSimulation() {
    try {
      // Start with basic forces
      this.simulation = d3.forceSimulation(this.nodes)
        .force('charge', d3.forceManyBody()
          .strength(this.currentChargeStrength))
        .force('collision', d3.forceCollide()
          .radius(d => d.type === 'terminal' ? 8 : 6))
        .alpha(1)
        .alphaDecay(0.02)
        .velocityDecay(0.4);
      
      // Add link force
      if (this.links.length > 0) {
        this.simulation.force('link', d3.forceLink(this.links)
          .id(d => d.id)
          .strength(this.currentLinkStrength));
      }

      // Apply root lock after D3 has initialized node positions.
      this._applyRootLock();

      // Register wind force if enabled.
      this._updateWindForce();
    } catch (e) {
      console.error('[ForceDirectedVisualization] Error creating simulation:', e.message);
      throw e;
    }
  }

  /**
   * Render link elements (edges).
   * @private
   */
  _renderLinks() {
    this.linkElements = this.g.selectAll('line.link')
      .data(this.links, d => `${d.sourceId}-${d.targetId}`)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', this.edgeThickness);
  }

  /**
   * Render node elements (layered: circles + silhouettes + labels).
   * @private
   */
  _renderNodes() {
    // Create groups for each node (will contain circle + silhouette + label)
    const nodeGroups = this.g.selectAll('g.node-group')
      .data(this.nodes, d => d.id)
      .enter()
      .append('g')
      .attr('class', 'node-group');

    // Render grey background circles
    this.nodeCircles = nodeGroups
      .append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => this._getNodeCircleRadius(d))
      .attr('fill', '#ccc')
      .attr('opacity', 0.6)
      .attr('pointer-events', 'all');

    // Render colored node circles (visible nodes)
    this.nodeElements = nodeGroups
      .append('circle')
      .attr('class', 'node-marker')
      .attr('r', d => d.type === 'terminal' ? 6 : 4)
      .attr('fill', d => d.type === 'terminal' ? '#2E86AB' : '#A23B72')
      .attr('opacity', 0.8)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('pointer-events', 'none');

    // Render silhouettes for terminal species (if available)
    this._renderSilhouettes(nodeGroups);

    // Add drag behavior to the entire node group
    nodeGroups.call(this._addDragBehavior.bind(this));

    // Add hover effect to grey circles
    this.nodeCircles
      .on('mouseenter', function() {
        d3.select(this).attr('opacity', 0.8);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 0.6);
      });
  }

  /**
   * Render silhouette SVG images for terminal species.
   * Silhouettes are centered on each node and scaled proportionally.
   * Uses SVG foreignObject to embed external SVG files with proper styling.
   * @private
   */
  _renderSilhouettes(nodeGroups) {
    // Render silhouettes only for terminal nodes that have them
    let silhouetteCount = 0;
    nodeGroups.each((d, i, nodes) => {
      if (d.type === 'terminal' && d.silhouetteFilename) {
        silhouetteCount++;
        const group = d3.select(nodes[i]);
        
        // Create a group for silhouette that will contain an image element
        // Base size is 5x the node circle, adjusted by silhouetteSizePercent
        const baseSize = this._getNodeCircleRadius(d) * 5;
        const silhouetteSize = baseSize * (this.silhouetteSizePercent / 100);
        
        // Create an image element with SVG-specific attributes
        // Use <image> with proper scaling and SVG support
        const silhouetteGroup = group
          .append('g')
          .attr('class', 'silhouette-group')
          .attr('transform', `translate(${this.silhouetteXOffset},${this.silhouetteYOffset})`);
        
        silhouetteGroup
          .append('image')
          .attr('class', 'silhouette')
          .attr('x', -silhouetteSize / 2)
          .attr('y', -silhouetteSize / 2)
          .attr('width', silhouetteSize)
          .attr('height', silhouetteSize)
          .attr('preserveAspectRatio', 'xMidYMid meet')
          .attr('href', `./assets/silhouettes/${d.silhouetteFilename}`)
          .attr('opacity', 0.85)
          .attr('pointer-events', 'none')
          .style('mix-blend-mode', 'multiply')
          .on('load', function() {
            console.log(`[Silhouette] Loaded: ${d.silhouetteFilename}`);
          })
          .on('error', function() {
            // Silhouette failed to load - just log it, don't crash
            console.warn(`[Silhouette] Failed to load: ${d.silhouetteFilename}`);
          });
      }
    });
    console.log(`[Silhouettes] Rendered ${silhouetteCount} silhouettes for terminal nodes`);
  }

  /**
   * Render text labels for terminal species.
   * Displays common name (above) and scientific name (below, italic).
   * @private
   */
  _renderLabels() {
    // Render common names (top line)
    const commonNameLabels = this.g.selectAll('g.node-group').selectAll('text.node-label-common')
      .data(d => (d.type === 'terminal' && d.commonName) ? [d] : [], d => d.id)
      .enter()
      .append('text')
      .attr('class', 'node-label-common')
      .attr('font-size', `${this.fontSizeBase}px`)
      .attr('font-family', 'Jost, sans-serif')
      .attr('font-weight', 'normal')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.4em')  // Offset upward
      .attr('fill', '#333')
      .text(d => d.commonName)
      .attr('pointer-events', 'none');

    // Render scientific names (bottom line, italic)
    const scientificNameLabels = this.g.selectAll('g.node-group').selectAll('text.node-label-scientific')
      .data(d => (d.type === 'terminal' && d.scientificName) ? [d] : [], d => d.id)
      .enter()
      .append('text')
      .attr('class', 'node-label-scientific')
      .attr('font-size', `${this.fontSizeBase}px`)
      .attr('font-family', 'Jost, sans-serif')
      .attr('font-style', 'italic')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.8em')  // Offset downward
      .attr('fill', '#666')
      .text(d => d.scientificName)
      .attr('pointer-events', 'none');

    // Store references for updating font size
    this.labelElements = commonNameLabels;
    this.scientificLabelElements = scientificNameLabels;
  }

  /**
   * Render date labels for ancestral nodes.
   * Only displays if showNodeDates is true and divergenceData is available.
   * Uses the helper to get divergence estimates (returns null for 0 or multiple estimates).
   * @private
   */
  _renderDateLabels() {
    if (!this.showNodeDates || !this.divergenceData) {
      const existing = this.g.selectAll('g.node-group').selectAll('text.node-date-label');
      existing.remove();
      return;
    }

    // Extract central estimate for each node from divergenceData
    // Use helper that returns null for 0 or multiple estimates (never silently selects)
    const datesByNodeId = {};
    if (this.hypothesisId) {
      const estimatesByHypothesis = this.divergenceData.estimatesByHypothesis || {};
      const hypothesisEstimates = estimatesByHypothesis[this.hypothesisId];
      
      if (hypothesisEstimates) {
        for (const nodeId in hypothesisEstimates) {
          const divergenceAge = this._getDivergenceEstimate(nodeId);
          if (divergenceAge !== null) {
            const unit = 'Ma';
            datesByNodeId[nodeId] = `${divergenceAge}${unit}`;
          }
        }
      }
    }

    // Render date labels for ancestral nodes that have dates
    // For each node group with internal nodes that have dates, add a text element
    let addedCount = 0;
    
    this.g.selectAll('g.node-group').each((d, i, nodes) => {
      const element = nodes[i];
      if (d.type === 'internal' && datesByNodeId[d.id]) {
        addedCount++;
        // Check if text already exists
        const existingText = d3.select(element).selectAll('text.node-date-label');
        if (existingText.empty()) {
          d3.select(element).append('text')
            .attr('class', 'node-date-label')
            .attr('font-family', 'Jost, sans-serif')
            .attr('font-size', `${this.fontSizeBase * 0.75}px`)
            .attr('text-anchor', 'middle')
            .attr('dy', '1.2em')
            .attr('fill', '#999')
            .attr('pointer-events', 'none')
            .text(datesByNodeId[d.id]);
        } else {
          // Update existing
          existingText
            .attr('font-size', `${this.fontSizeBase * 0.75}px`)
            .text(datesByNodeId[d.id]);
        }
      }
    });
    
    // Remove date labels from nodes that no longer have them
    this.g.selectAll('g.node-group').each((d, i, nodes) => {
      const element = nodes[i];
      if (!datesByNodeId[d.id]) {
        d3.select(element).selectAll('text.node-date-label').remove();
      }
    });
  }

  /**
   * Get all descendant taxa (terminal nodes) for a given ancestral node.
   * @private
   */
  _getDescendantTaxa(nodeId, visited = new Set()) {
    if (!this.phyloGraph) return [];
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const children = this.phyloGraph.getChildren(nodeId);
    const descendants = [];

    for (const childId of children) {
      const childVizNode = this.nodes.find(n => n.id === childId);
      if (childVizNode && childVizNode.type === 'terminal') {
        descendants.push(childVizNode);
      } else {
        descendants.push(...this._getDescendantTaxa(childId, visited));
      }
    }

    return descendants;
  }

  /**
   * Generate a descriptive label for an ancestral node based on its descendants.
   * @private
   */
  _generateAncestralLabel(nodeId, node) {
    // Use formal clade name if available
    if (node && node.cladeName) {
      return node.cladeName;
    }

    // Generate label from descendants
    const descendants = this._getDescendantTaxa(nodeId);
    if (descendants.length === 0) {
      return null;
    }

    // Sort by common name for consistency
    descendants.sort((a, b) => {
      const aName = a.commonName || a.scientificName || a.id;
      const bName = b.commonName || b.scientificName || b.id;
      return aName.localeCompare(bName);
    });

    // Generate label based on number of descendants
    if (descendants.length === 1) {
      return `Ancestor of ${descendants[0].commonName || descendants[0].scientificName}`;
    } else if (descendants.length === 2) {
      return `Common ancestor of ${descendants[0].commonName || descendants[0].scientificName} and ${descendants[1].commonName || descendants[1].scientificName}`;
    } else if (descendants.length <= 4) {
      const names = descendants.slice(0, 3).map(d => d.commonName || d.scientificName).join(', ');
      return `Common ancestor of ${names}, and ${descendants.length - 3} other`;
    } else {
      const firstName = descendants[0].commonName || descendants[0].scientificName;
      return `Common ancestor of ${firstName} and ${descendants.length - 1} others`;
    }
  }

  _renderAncestralLabels() {
    if (!this.showAncestralLabels || !this.hypothesisData) {
      const existing = this.g.selectAll('g.node-group').selectAll('text.ancestral-label');
      existing.remove();
      return;
    }

    // Build a map of node ID to hypothesis node (for clade names)
    const hypothesisNodesByNodeId = {};
    if (this.hypothesisData && this.hypothesisData.nodes) {
      for (const node of this.hypothesisData.nodes) {
        if (node.id) {
          hypothesisNodesByNodeId[node.id] = node;
        }
      }
    }

    // Render ancestral labels for internal nodes
    this.g.selectAll('g.node-group').each((d, i, nodes) => {
      const element = nodes[i];
      if (d.type === 'internal') {
        // Skip root node (it's already labeled separately)
        if (d.id === this.rootNodeId) {
          return;
        }

        const hypothesisNode = hypothesisNodesByNodeId[d.id];
        const label = this._generateAncestralLabel(d.id, hypothesisNode);

        if (label) {
          // Check if text already exists
          const existingText = d3.select(element).selectAll('text.ancestral-label');
          if (existingText.empty()) {
            d3.select(element).append('text')
              .attr('class', 'ancestral-label')
              .attr('font-family', 'Jost, sans-serif')
              .attr('font-size', `${this.fontSizeBase * 0.85}px`)
              .attr('text-anchor', 'middle')
              .attr('dy', '1.0em')
              .attr('fill', '#555')
              .attr('pointer-events', 'none')
              .text(label);
          } else {
            // Update existing
            existingText
              .attr('font-size', `${this.fontSizeBase * 0.85}px`)
              .text(label);
          }
        } else {
          d3.select(element).selectAll('text.ancestral-label').remove();
        }
      }
    });
  }

  /**
   * Render the root node label.
   * @private
   */
  _renderRootLabel() {
    if (!this.rootNodeId) return;

    // Find root node in viz nodes
    const rootVizNode = this.nodes.find(n => n.id === this.rootNodeId);
    if (!rootVizNode) return;

    // Find the corresponding D3 group
    const rootGroup = this.g.selectAll('g.node-group').filter(d => d.id === this.rootNodeId);
    
    if (!rootGroup.empty()) {
      const existingLabel = rootGroup.selectAll('text.root-label');
      const label = rootVizNode.scientificName || rootVizNode.label || 'Root';
      
      if (existingLabel.empty()) {
        rootGroup.append('text')
          .attr('class', 'root-label')
          .attr('font-family', 'Jost, sans-serif')
          .attr('font-size', `${this.fontSizeBase}px`)
          .attr('font-weight', 'bold')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.3em')
          .attr('fill', '#222')
          .attr('pointer-events', 'none')
          .text(label);
      }
    }
  }

  /**
   * Get the radius of a node's grey background circle.
   * @private
   */
  _getNodeCircleRadius(d) {
    const baseRadius = d.type === 'terminal' ? 12 : 8;
    return baseRadius * this.nodeCircleScale;
  }

  /**
   * Add drag behavior to nodes.
   * @private
   */
  _addDragBehavior(selection) {
    selection.call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);

        if (d.id === this.rootNodeId && this.lockRootPosition) {
          // Keep a locked root pinned at its newly dragged position.
          d.fx = d.x;
          d.fy = d.y;
        } else {
          d.fx = null;
          d.fy = null;
        }
      }));
  }

  /**
   * Add zoom and pan behavior.
   * @private
   */
  _addZoomBehavior() {
    this.zoom = d3.zoom()
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);
  }

  /**
   * Update on each simulation tick.
   * @private
   */
  _onTick() {
    // Update link positions
    if (this.linkElements) {
      this.linkElements
        .attr('x1', d => this.nodes[d.source.index].x)
        .attr('y1', d => this.nodes[d.source.index].y)
        .attr('x2', d => this.nodes[d.target.index].x)
        .attr('y2', d => this.nodes[d.target.index].y);
    }

    // Update node group positions
    this.g.selectAll('g.node-group')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Update silhouette-group transforms (size and offset)
    // The group contains the image element and controls overall sizing and positioning
    this.g.selectAll('g.silhouette-group')
      .attr('transform', d => {
        const baseSize = this._getNodeCircleRadius(d) * 5;
        const silhouetteSize = baseSize * (this.silhouetteSizePercent / 100);
        // Note: offset is applied via translate, not by moving the image x/y
        return `translate(${this.silhouetteXOffset},${this.silhouetteYOffset})`;
      });

    // Update silhouette image sizes within the group
    this.g.selectAll('image.silhouette')
      .attr('x', d => {
        const baseSize = this._getNodeCircleRadius(d) * 5;
        const silhouetteSize = baseSize * (this.silhouetteSizePercent / 100);
        return -silhouetteSize / 2;
      })
      .attr('y', d => {
        const baseSize = this._getNodeCircleRadius(d) * 5;
        const silhouetteSize = baseSize * (this.silhouetteSizePercent / 100);
        return -silhouetteSize / 2;
      })
      .attr('width', d => {
        const baseSize = this._getNodeCircleRadius(d) * 5;
        return baseSize * (this.silhouetteSizePercent / 100);
      })
      .attr('height', d => {
        const baseSize = this._getNodeCircleRadius(d) * 5;
        return baseSize * (this.silhouetteSizePercent / 100);
      })
      .attr('opacity', this.silhouetteOpacity)
      .style('filter', this._getSilhouetteGrayscaleFilter(this.silhouetteGrayscale));
  }

  /**
   * Immediately update silhouettes without waiting for simulation tick.
   * Called when silhouette size, position, opacity, or grayscale changes.
   * @private
   */
  _updateSilhouettesImmediate() {
    if (!this.g) return; // Visualization not yet rendered
    
    // Update silhouette-group transforms (size and offset)
    this.g.selectAll('g.silhouette-group')
      .attr('transform', d => {
        const baseSize = this._getNodeCircleRadius(d) * 5;
        const silhouetteSize = baseSize * (this.silhouetteSizePercent / 100);
        return `translate(${this.silhouetteXOffset},${this.silhouetteYOffset})`;
      });

    // Update silhouette image sizes within the group
    this.g.selectAll('image.silhouette')
      .attr('x', d => {
        const baseSize = this._getNodeCircleRadius(d) * 5;
        const silhouetteSize = baseSize * (this.silhouetteSizePercent / 100);
        return -silhouetteSize / 2;
      })
      .attr('y', d => {
        const baseSize = this._getNodeCircleRadius(d) * 5;
        const silhouetteSize = baseSize * (this.silhouetteSizePercent / 100);
        return -silhouetteSize / 2;
      })
      .attr('width', d => {
        const baseSize = this._getNodeCircleRadius(d) * 5;
        return baseSize * (this.silhouetteSizePercent / 100);
      })
      .attr('height', d => {
        const baseSize = this._getNodeCircleRadius(d) * 5;
        return baseSize * (this.silhouetteSizePercent / 100);
      })
      .attr('opacity', this.silhouetteOpacity)
      .style('filter', this._getSilhouetteGrayscaleFilter(this.silhouetteGrayscale));
  }

  /**
   * Get the divergence age (Ma) for a node.
   * 
   * Returns the central estimate only when exactly one estimate is available.
   * Returns null when there are zero or multiple estimates (never silently selects first).
   * Returns null if divergence data is unavailable.
   * 
   * @param {string} nodeId - The node ID
   * @returns {number|null} Central estimate in Ma, or null if unavailable or ambiguous
   * @private
   */
  _getDivergenceEstimate(nodeId) {
    if (!this.divergenceData || !nodeId || !this.hypothesisId) {
      return null;
    }

    const estimatesByHypothesis = this.divergenceData.estimatesByHypothesis || {};
    
    // Navigate: hypothesisId -> nodeId -> {estimates: [...]}
    const hypothesisEstimates = estimatesByHypothesis[this.hypothesisId];
    if (!hypothesisEstimates) {
      return null;
    }
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) {
      return null;
    }
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) {
      return null;
    }
    
    // Only return if exactly one estimate exists
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    // Multiple estimates: return null (don't silently select first)
    // Zero estimates: return null
    return null;
  }

  /**
   * Compute per-link strength using base strength, root-proximity modifier, and age modifier.
   * 
   * Formula:
   * rootContribution = baseLinkStrength * (rootLinkStrength / 100) * (1 - childDepth / maxDepth)
   * ageContribution = (ageLinkStrength / 1000) * (divergenceAgeMa / 100)
   * edgeStrength = baseLinkStrength + rootContribution + ageContribution
   * 
   * Scaling:
   * - rootLinkStrength: UI 0-1000 → internal 0-10 via /100 conversion
   * - ageLinkStrength: UI 0-100 → coefficient scaled by age/100 normalization
   *   - At max slider (100), max age (320 Ma): 100/1000 * 320/100 = 0.32 contribution
   *   - At mid slider (50), median age (80 Ma): 50/1000 * 80/100 = 0.04 contribution
   *   - At max slider (100), young age (6 Ma): 100/1000 * 6/100 = 0.006 contribution
   *
   * @param {Object} link - D3 link object with source/target
   * @param {number} baseLinkStrength - Base link strength (0-1)
   * @param {number} rootLinkStrength - Root proximity modifier (UI 0-1000)
   * @param {number} ageLinkStrength - Age modifier coefficient (UI 0-100)
   * @returns {number} Per-link strength value
   * @private
   */
  _computePerLinkStrength(link, baseLinkStrength, rootLinkStrength, ageLinkStrength) {
    let strength = baseLinkStrength;

    // Root-proximity contribution
    // rootLinkStrength is UI 0-1000, convert to internal 0-10 via /100
    const internalRootStrength = rootLinkStrength / 100;
    if (internalRootStrength > 0 && this.maxDepth > 0) {
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const childDepth = this.nodeDepths[targetId] || 0;
      const depthFraction = childDepth / this.maxDepth;
      const rootContribution = baseLinkStrength * internalRootStrength * (1 - depthFraction);
      strength += rootContribution;
    }

    // Age-based contribution
    // ageLinkStrength is UI 0-100, normalized by age in hundreds of Ma
    if (ageLinkStrength > 0 && this.divergenceData) {
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      // Get the divergence age for this node using the helper
      // Returns null if zero or multiple estimates (never silently selects)
      const divergenceAgeMa = this._getDivergenceEstimate(targetId);
      
      if (divergenceAgeMa !== null && divergenceAgeMa > 0) {
        // Scale: (ageLinkStrength / 1000) * (age / 100)
        // Normalizes ages to roughly 0-3.2 range (since max age ~320 Ma)
        const ageContribution = (ageLinkStrength / 1000) * (divergenceAgeMa / 100);
        strength += ageContribution;
      }
    }

    return strength;
  }

  /**
   * Update the charge/repulsion force.
   */
  setChargeStrength(strength) {
    this.currentChargeStrength = strength;
    if (this.simulation) {
      this.simulation.force('charge', d3.forceManyBody()
        .strength(strength));
      this.simulation.alpha(0.3).restart();
    }
  }

  /**
   * Update the link/spring force.
   * Uses per-link strength accessor to support root-proximity and age-based modifiers.
   */
  setLinkStrength(strength) {
    this.currentLinkStrength = strength;
    if (this.simulation) {
      // Update the existing force instead of recreating it
      // This preserves D3's internal state and ensures idempotent updates
      const linkForce = this.simulation.force('link');
      if (linkForce) {
        // Use per-link strength accessor if modifiers are active
        if (this.currentRootLinkStrength > 0 || this.currentAgeLinkStrength > 0) {
          linkForce.strength(link => 
            this._computePerLinkStrength(
              link, 
              strength, 
              this.currentRootLinkStrength, 
              this.currentAgeLinkStrength
            )
          );
        } else {
          // Use scalar value when no modifiers are active
          linkForce.strength(strength);
        }
      } else {
        // Fallback: if no link force exists, create one
        this.simulation.force('link', d3.forceLink(this.links)
          .id(d => d.id)
          .strength(link => 
            this._computePerLinkStrength(
              link, 
              strength, 
              this.currentRootLinkStrength, 
              this.currentAgeLinkStrength
            )
          ));
      }
      this.simulation.alpha(0.3).restart();
    }
  }

  /**
   * Set root-proximity link strength modifier.
   * Strengthens edges near the root; affects parent-child pulling.
   * 
   * @param {number} value - UI value (0-100), converted to internal 0-10
   */
  setRootLinkStrength(value) {
    // Store the raw UI value (0-1000) for use in _computePerLinkStrength
    // Conversion to internal 0-10 happens in _computePerLinkStrength via /100
    this.currentRootLinkStrength = value;
    if (this.simulation) {
      // Recompute link force with new modifier
      this.setLinkStrength(this.currentLinkStrength);
    }
  }

  /**
   * Set age-based link strength modifier.
   * Adds strength based on divergence age (Ma), normalized by age/100.
   * Formula: ageContribution = (ageLinkStrength / 1000) * (divergenceAgeMa / 100)
   * 
   * @param {number} value - UI coefficient 0-100 (produces scaled age contribution)
   */
  setAgeLinkStrength(value) {
    this.currentAgeLinkStrength = value;
    if (this.simulation) {
      // Recompute link force with new modifier
      this.setLinkStrength(this.currentLinkStrength);
    }
  }

  /**
   * Reset the view to initial zoom/pan.
   */
  resetView() {
    if (this.svg && this.zoom) {
      this.svg.transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity
          .translate(this.options.width / 2, this.options.height / 2)
          .scale(1));
    }
  }

  /**
   * Handle window resize.
   */
  handleResize(width, height) {
    this.options.width = width;
    this.options.height = height;
    
    if (this.svg) {
      this.svg
        .attr('width', width)
        .attr('height', height);
    }

    if (this.simulation) {
      this.simulation.force('center', d3.forceCenter(width / 2, height / 2));
      this.simulation.alpha(0.3).restart();
    }
  }

  /**
   * Update edge thickness without rebuilding the graph.
   */
  setEdgeThickness(thickness) {
    this.edgeThickness = thickness;
    if (this.linkElements) {
      this.linkElements.attr('stroke-width', thickness);
    }
  }

  /**
   * Update node circle size without resetting positions or selection.
   */
  setNodeCircleSize(scale) {
    this.nodeCircleScale = scale;
    if (this.nodeCircles) {
      this.nodeCircles.attr('r', d => this._getNodeCircleRadius(d));
    }
    // Also update silhouette sizes (3x node circle for visibility)
    if (this.g) {
      this.g.selectAll('image.silhouette')
        .attr('width', d => this._getNodeCircleRadius(d) * 3)
        .attr('height', d => this._getNodeCircleRadius(d) * 3)
        .attr('x', d => -this._getNodeCircleRadius(d) * 1.5 + this.silhouetteXOffset)
        .attr('y', d => -this._getNodeCircleRadius(d) * 1.5 + this.silhouetteYOffset);
    }
  }

  /**
   * Update graph font size without resetting positions or selection.
   */
  setGraphFontSize(sizePixels) {
    this.fontSizeBase = sizePixels;
    if (this.labelElements) {
      this.labelElements.attr('font-size', `${sizePixels}px`);
    }
    if (this.scientificLabelElements) {
      this.scientificLabelElements.attr('font-size', `${sizePixels}px`);
    }
    if (this.nodeDateLabels) {
      this.nodeDateLabels.attr('font-size', `${sizePixels * 0.75}px`);
    }
  }

  /**
   * Set horizontal offset for silhouettes (in pixels).
   */
  setSilhouetteXOffset(offsetPixels) {
    this.silhouetteXOffset = offsetPixels;
    // Immediately update silhouettes without waiting for simulation tick
    this._updateSilhouettesImmediate();
  }

  /**
   * Set vertical offset for silhouettes (in pixels).
   */
  setSilhouetteYOffset(offsetPixels) {
    this.silhouetteYOffset = offsetPixels;
    // Immediately update silhouettes without waiting for simulation tick
    this._updateSilhouettesImmediate();
  }

  /**
   * Set silhouette size as a percentage of default (100 = 5x node radius).
   */
  setSilhouetteSize(sizePercent) {
    this.silhouetteSizePercent = Math.max(30, Math.min(300, sizePercent));
    // Immediately update silhouettes without waiting for simulation tick
    this._updateSilhouettesImmediate();
  }

  /**
   * Set silhouette opacity (0-1).
   */
  setSilhouetteOpacity(opacity) {
    this.silhouetteOpacity = Math.max(0, Math.min(1, opacity));
    // Immediately update silhouettes without waiting for simulation tick
    this._updateSilhouettesImmediate();
  }

  /**
   * Set silhouette grayscale amount (0-100, 0=black, 50=gray, 100=white).
   */
  setSilhouetteGrayscale(grayscale) {
    this.silhouetteGrayscale = Math.max(0, Math.min(100, grayscale));
    // Immediately update silhouettes without waiting for simulation tick
    this._updateSilhouettesImmediate();
  }

  /**
   * Generate CSS filter string for silhouette grayscale.
   * At 0%, the image is fully black (saturate 0%, brightness 0%).
   * At 50%, the image is medium gray (saturate 0%, brightness 50%).
   * At 100%, the image is fully white (saturate 0%, brightness 100%).
   * @private
   */
  _getSilhouetteGrayscaleFilter(grayscalePercent) {
    if (grayscalePercent === 50) {
      // Middle gray: desaturate and set to 50% brightness
      return 'grayscale(100%) brightness(0.5)';
    } else if (grayscalePercent < 50) {
      // Darker: interpolate from black (0%) to gray (50%)
      const brightness = grayscalePercent / 50;  // 0 to 1
      return `grayscale(100%) brightness(${brightness})`;
    } else {
      // Lighter: interpolate from gray (50%) to white (100%)
      const brightness = grayscalePercent / 100;  // 0.5 to 1
      return `grayscale(100%) brightness(${brightness})`;
    }
  }

  /**
   * Toggle display of node date labels.
   * 
   * Note: This controls label visibility only. Divergence data is passed during
   * construction (divergenceData option) and is independent of this toggle.
   * The divergence data is used for force calculations regardless of label visibility.
   * 
   * @param {boolean} show - Whether to show date labels
   * @param {Object} divergenceData - (Optional) If provided, store this as the current data
   */
  setShowNodeDates(show, divergenceData) {
    this.showNodeDates = show;
    
    // If new divergence data is provided, update it
    // (For backward compatibility with existing code that passes data here)
    if (divergenceData) {
      this.divergenceData = divergenceData;
    }
    
    this._renderDateLabels();
  }

  /**
   * Toggle display of ancestral node labels.
   */
  setShowAncestralLabels(show, hypothesisData, phyloGraph) {
    this.showAncestralLabels = show;
    this.hypothesisData = hypothesisData;
    
    // If a different graph is supplied, update both phyloGraph and graphDistances together
    if (phyloGraph && phyloGraph !== this.phyloGraph) {
      this._initializeGraphAndCache(phyloGraph);
    }
    
    this._renderAncestralLabels();
  }

  /**
   * Compute shortest-path distances between all pairs of nodes in the phylogenetic graph.
   * Uses BFS (breadth-first search) from each node.
   * 
   * Requires a valid PhyloGraph with getNodes() and getChildren(nodeId) methods.
   * 
   * @param {PhyloGraph} phyloGraph - The immutable phylogenetic graph object
   * @returns {Object} Map of node ID -> Map of node ID -> distance
   * @throws {Error} If phyloGraph is missing required methods
   * @private
   */
  _computeGraphDistances(phyloGraph) {
    // Validate that we have the correct graph API
    if (!phyloGraph || typeof phyloGraph.getNodes !== 'function') {
      throw new Error(
        'Invalid graph object: must have getNodes() method. ' +
        'Received: ' + (phyloGraph ? Object.keys(phyloGraph).join(', ') : 'null')
      );
    }

    const distances = {};
    const graphNodes = phyloGraph.getNodes();

    // BFS from each node to compute distances to all other nodes
    for (const [fromNodeId, fromNode] of graphNodes) {
      const visited = new Set();
      const queue = [[fromNodeId, 0]];
      visited.add(fromNodeId);

      while (queue.length > 0) {
        const [currentId, dist] = queue.shift();

        if (!distances[fromNodeId]) {
          distances[fromNodeId] = {};
        }
        distances[fromNodeId][currentId] = dist;

        // Find neighbors using the graph API: parent and children
        const neighbors = [];

        // Get parent
        try {
          const parentId = phyloGraph.getParent(currentId);
          if (parentId) {
            neighbors.push(parentId);
          }
        } catch (e) {
          // Node may not exist, continue
        }

        // Get children
        try {
          const childrenIds = phyloGraph.getChildren(currentId);
          if (childrenIds && Array.isArray(childrenIds)) {
            neighbors.push(...childrenIds);
          }
        } catch (e) {
          // Node may not exist, continue
        }

        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push([neighborId, dist + 1]);
          }
        }
      }
    }

    return distances;
  }

  /**
   * Compute depth (distance from root) for each visualization node.
   * Depth is the number of edges from root to this node.
   * 
   * @returns {Object} Map of nodeId to depth
   * @private
   */
  _computeNodeDepths() {
    const depths = {};
    
    if (!this.rootNodeId) {
      console.warn('[ForceDirectedVisualization] No root node set; cannot compute depths');
      return depths;
    }

    // BFS from root to assign depths
    const queue = [[this.rootNodeId, 0]];
    const visited = new Set([this.rootNodeId]);
    depths[this.rootNodeId] = 0;

    while (queue.length > 0) {
      const [nodeId, depth] = queue.shift();
      const vizNode = this.nodes.find(n => n.id === nodeId);
      
      if (!vizNode) continue;

      // For each child of this node (in visualization links),
      // find the next depth level
      const childLinks = this.links.filter(l => 
        (typeof l.source === 'object' ? l.source.id : l.source) === nodeId
      );

      for (const link of childLinks) {
        const childId = typeof link.target === 'object' ? link.target.id : link.target;
        
        if (!visited.has(childId)) {
          visited.add(childId);
          depths[childId] = depth + 1;
          queue.push([childId, depth + 1]);
        }
      }
    }

    return depths;
  }

  /**
   * Calculate topology-aware repulsion force strength based on graph distance.
   * Uses inverse-square distance decay: strength = scaleFactor / (1 + distance^2)
   * 
   * This creates stronger repulsion for nodes close in the phylogenetic tree,
   * and weaker repulsion for nodes farther apart.
   * 
   * @param {number} graphDistance - Shortest-path distance in the phylogenetic graph
   * @param {number} scaleFactor - Scaling factor (slider value / 100)
   * @returns {number} Repulsion force strength
   * @private
   */
  _calculateTopoRepulsion(graphDistance, scaleFactor) {
    if (graphDistance === 0) return 0;  // Same node, no force
    if (scaleFactor === 0) return 0;    // Feature disabled
    
    // Inverse-square distance decay: stronger at small distances, weaker at large
    // Bounded to prevent numerical instability
    const decayFactor = 1 + (graphDistance * graphDistance);
    return scaleFactor / decayFactor;
  }

  /**
   * Set topology repulsion baseline parameter (A).
   * Part of equation: F_topology = B * (A + X) / D
   * 
   * @param {number} value - UI value (0-100), converted to internal 0-10
   */
  setTopologyRepulsionA(value) {
    this.topologyRepulsionA = value / 10;  // Convert from UI (0-100) to internal (0-10)
    this._updateTopologyRepulsion();
  }

  /**
   * Set topology repulsion force scale multiplier (B).
   * Part of equation: F_topology = B * (A + X) / D
   * 
   * @param {number} value - UI value (0-100), converted to internal 0-10
   */
  setTopologyRepulsionB(value) {
    this.topologyRepulsionB = value / 10;  // Convert from UI (0-100) to internal (0-10)
    this._updateTopologyRepulsion();
  }

  /**
   * Set topology repulsion master strength (X).
   * Part of equation: F_topology = B * (A + X) / D
   * When X = 0, topology repulsion is completely disabled.
   * 
   * @param {number} value - UI value (0-100), converted to internal 0-10
   */
  setTopologyRepulsionX(value) {
    this.topologyRepulsionX = value / 10;  // Convert from UI (0-100) to internal (0-10)
    this._updateTopologyRepulsion();
  }

  /**
   * Internal helper to update topology repulsion force after any parameter changes.
   * Recomputes and restarts the simulation if needed.
   * @private
   */
  _updateTopologyRepulsion() {
    // If X = 0, disable completely
    if (this.topologyRepulsionX === 0) {
      if (this.topoRepulsionForce && this.simulation) {
        this.simulation.force('topoRepulsion', null);
        this.topoRepulsionForce = null;
      }
      return;
    }

    // If we don't have a simulation yet, can't set up the force
    if (!this.simulation) {
      return;
    }

    // Check that we have the required graph distance data
    if (!this.graphDistances) {
      console.warn('[ForceDirectedVisualization] Cannot enable topology repulsion: no graph distances computed. ' +
                   'Supply a valid PhyloGraph during construction or via setShowAncestralLabels().');
      return;
    }

    // Create custom force using the A/B/X equation
    this.topoRepulsionForce = (alpha) => {
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const a = this.nodes[i];
          const b = this.nodes[j];

          // Get graph distance between nodes
          const graphDist = (this.graphDistances[a.id] && this.graphDistances[a.id][b.id]) || 
                           (this.graphDistances[b.id] && this.graphDistances[b.id][a.id]) || 
                           Infinity;

          if (graphDist === Infinity) continue;  // Not connected in graph

          // Clamp graph distance to at least 1 to avoid division issues
          const D = Math.max(graphDist, 1);

          // Compute topology repulsion using the equation: F = B * (A + X) / D
          // Where:
          //   B = overall force multiplier (0-10)
          //   A = baseline offset (0-10)
          //   X = master control strength (0-10)
          //   D = shortest-path graph distance
          const F_magnitude = this.topologyRepulsionB * (this.topologyRepulsionA + this.topologyRepulsionX) / D;

          if (F_magnitude === 0) continue;

          // Calculate spatial vector from b to a
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const spatialDistance = Math.sqrt(dx * dx + dy * dy);

          // Avoid division by zero for coincident nodes
          if (spatialDistance === 0) continue;

          // Apply repulsion along the spatial direction
          // Reduce effect with spatial distance to prevent extreme pushes
          const pixelDistance = Math.max(spatialDistance, 1);
          const force = F_magnitude * alpha / pixelDistance;

          const fx = (dx / spatialDistance) * force;
          const fy = (dy / spatialDistance) * force;

          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    };

    // Update the force in the simulation
    this.simulation.force('topoRepulsion', this.topoRepulsionForce);
    this.simulation.alpha(0.3).restart();
  }

  /**
   * Legacy: Set topology-aware repulsion strength and reapply the force.
   * 
   * Topology repulsion adds additional distance-based repulsion on top of
   * the ordinary D3 many-body charge force. Nodes close together in the
   * phylogenetic graph experience stronger additional repulsion.
   * 
   * This method is maintained for backward compatibility but no longer used.
   * Use setTopologyRepulsionX() instead.
   * 
   * @param {number} strength - Slider value (0-100), where 0 disables this force
   * @param {Object} phyloGraph - The immutable PhyloGraph object
   * @deprecated
   */
  setTopologyRepulsion(strength, phyloGraph) {
    // For backward compatibility, treat the old strength value as X
    this.setTopologyRepulsionX(strength);

    // Cache graph if provided
    if (phyloGraph && typeof phyloGraph.getNodes === 'function' && !this.graphDistances) {
      this.graphDistances = this._computeGraphDistances(phyloGraph);
    }
  }


  /**
   * Get diagnostic information about asset loading for a specific taxon.
   * @param {string} taxonId - The taxon ID to check
   * @returns {Object|null} Asset metadata or null if not found
   */
  getAssetDiagnostics(taxonId) {
    return this.assetMetadata?.[taxonId] || null;
  }

  /**
   * Apply or release the root position lock.
   * @private
   */
  _applyRootLock() {
    const root = this.nodes.find(node => node.id === this.rootNodeId);
    if (!root) return;

    if (this.lockRootPosition) {
      root.fx = root.x;
      root.fy = root.y;
      root.vx = 0;
      root.vy = 0;
    } else {
      root.fx = null;
      root.fy = null;
    }
  }

  /**
   * Set whether the root is locked in place.
   * @param {boolean} locked - True to lock the root, false to release it
   */
  setRootLocked(locked) {
    this.lockRootPosition = Boolean(locked);
    this._applyRootLock();

    // If wind is active, update it to reflect the new root participation
    if (this.windStrength > 0) {
      this._updateWindForce();
    }

    if (this.simulation) {
      this.simulation.alpha(0.3).restart();
    }
  }

  /**
   * Set the wind direction in degrees.
   * 0° = right, 90° = down, 180° = left, 270° = up
   * @param {number} degrees - Wind direction (0-360)
   */
  setWindDirection(degrees) {
    this.windDirection = ((Number(degrees) % 360) + 360) % 360;
    this._updateWindForce();
  }

  /**
   * Set the wind strength.
   * Wind strength is in the range 0-2000 (UI).
   * @param {number} strength - Wind strength (0-2000, clamped)
   */
  setWindStrength(strength) {
    this.windStrength = Math.max(0, Math.min(2000, Number(strength)));
    this._updateWindForce();
  }

  /**
   * Update or register the wind force in the D3 simulation.
   * 
   * Wind applies constant directional acceleration independently of simulation alpha,
   * ensuring it remains active even as the simulation cools.
   * 
   * Conversion: UI range 0-2000 → force magnitude 0-1.0
   * Formula: magnitude = (windStrength / 2000)
   * This produces the same max magnitude (1.0) as the previous 0-100 UI range with /100 conversion.
   * 
   * Root participation:
   * - If lockRootPosition is true: root is excluded from wind (remains pinned)
   * - If lockRootPosition is false: root participates in wind like other nodes
   * 
   * When wind strength is zero, the force is removed and alphaTarget is cleared to allow
   * normal simulation cooling.
   * 
   * @private
   */
  _updateWindForce() {
    if (!this.simulation) return;

    if (this.windStrength === 0) {
      // Wind disabled: remove force and restore normal simulation cooling
      this.simulation.force('wind', null);
      this.simulation.alphaTarget(0);  // Allow simulation to cool naturally
      this.windForce = null;
      return;
    }

    // Wind enabled: create directional force
    const radians = this.windDirection * Math.PI / 180;
    const forceX = Math.cos(radians);
    const forceY = Math.sin(radians);
    const magnitude = this.windStrength / 2000;  // Convert UI 0-2000 to force magnitude 0-1

    this.windForce = () => {
      for (const node of this.nodes) {
        // Exclude root only if it is locked in place.
        // If root is unlocked, it participates in wind like other nodes.
        if (node.id === this.rootNodeId && this.lockRootPosition) {
          continue;
        }

        node.vx += forceX * magnitude;
        node.vy += forceY * magnitude;
      }
    };

    this.simulation.force('wind', this.windForce);
    // Keep simulation running while wind is active.
    // Use a small alphaTarget to maintain gentle cooling while wind persists.
    this.simulation.alphaTarget(0.1);
    this.simulation.alpha(0.3).restart();
  }

  /**
   * Render the graph-paper grid as the first element in this.g.
   * The grid participates in zoom/pan transforms and covers a large range
   * to avoid visible edges when panning.
   * @private
   */
  _renderGrid() {
    // Remove existing grid if present
    this.g.selectAll('g.grid-container').remove();

    if (!this.showGrid) {
      this.gridElement = null;
      return;
    }

    // Create a grid container group as the first child of this.g
    this.gridElement = this.g
      .insert('g', ':first-child')
      .attr('class', 'grid-container')
      .attr('opacity', this.gridOpacity);

    // Draw grid lines using explicit SVG rendering for fine control
    // Large range covers panned and zoomed viewports
    const range = 5000;
    
    // Draw vertical grid lines
    for (let x = -range; x <= range; x += this.gridSpacing) {
      let lineWidth = this.gridMinorLineWidth;
      
      // Determine if this is a medium (every 5th) or major (every 10th) line
      const lineIndex = Math.round(x / this.gridSpacing);
      if (lineIndex % 10 === 0) {
        lineWidth = this.gridMajorLineWidth;
      } else if (lineIndex % 5 === 0) {
        lineWidth = this.gridMediumLineWidth;
      }

      this.gridElement.append('line')
        .attr('class', `grid-line grid-line-${lineIndex % 10 === 0 ? 'major' : lineIndex % 5 === 0 ? 'medium' : 'minor'}`)
        .attr('x1', x)
        .attr('y1', -range)
        .attr('x2', x)
        .attr('y2', range)
        .attr('stroke', '#4a9fb5')
        .attr('stroke-width', lineWidth);
    }

    // Draw horizontal grid lines
    for (let y = -range; y <= range; y += this.gridSpacing) {
      let lineWidth = this.gridMinorLineWidth;
      
      const lineIndex = Math.round(y / this.gridSpacing);
      if (lineIndex % 10 === 0) {
        lineWidth = this.gridMajorLineWidth;
      } else if (lineIndex % 5 === 0) {
        lineWidth = this.gridMediumLineWidth;
      }

      this.gridElement.append('line')
        .attr('class', `grid-line grid-line-${lineIndex % 10 === 0 ? 'major' : lineIndex % 5 === 0 ? 'medium' : 'minor'}`)
        .attr('x1', -range)
        .attr('y1', y)
        .attr('x2', range)
        .attr('y2', y)
        .attr('stroke', '#4a9fb5')
        .attr('stroke-width', lineWidth);
    }
  }

  /**
   * Update grid appearance (spacing, line widths, opacity).
   * Called when any grid setting changes.
   * @private
   */
  _updateGridAppearance() {
    if (!this.gridElement) return;

    // Update all minor grid lines (scoped to this visualization's grid)
    this.gridElement.selectAll('line.grid-line-minor')
      .attr('stroke-width', this.gridMinorLineWidth);

    // Update all medium grid lines (scoped to this visualization's grid)
    this.gridElement.selectAll('line.grid-line-medium')
      .attr('stroke-width', this.gridMediumLineWidth);

    // Update all major grid lines (scoped to this visualization's grid)
    this.gridElement.selectAll('line.grid-line-major')
      .attr('stroke-width', this.gridMajorLineWidth);

    // Update opacity of the grid container
    this.gridElement.attr('opacity', this.gridOpacity);
  }

  /**
   * Set whether the grid is visible.
   * When disabling, hides the grid without removing it.
   * When enabling, shows the grid or re-renders if needed.
   * @param {boolean} show - Whether to show the grid
   */
  setShowGrid(show) {
    this.showGrid = Boolean(show);
    
    if (this.showGrid) {
      // If grid doesn't exist, render it
      if (!this.gridElement) {
        this._renderGrid();
      } else {
        // If it exists, just show it
        this.gridElement.style('display', null);
      }
    } else {
      // Hide the grid without removing or regenerating
      if (this.gridElement) {
        this.gridElement.style('display', 'none');
      }
    }
  }

  /**
   * Set the spacing between minor grid lines.
   * @param {number} spacing - Distance in pixels
   */
  setGridSpacing(spacing) {
    this.gridSpacing = Math.max(10, Math.min(200, Number(spacing)));
    // Re-render the entire grid when spacing changes
    this._renderGrid();
  }

  /**
   * Set the width of minor grid lines.
   * @param {number} width - Stroke width in pixels
   */
  setGridMinorLineWidth(width) {
    this.gridMinorLineWidth = Math.max(0.25, Math.min(5, Number(width)));
    this._updateGridAppearance();
  }

  /**
   * Set the width of medium grid lines (every 5th).
   * @param {number} width - Stroke width in pixels
   */
  setGridMediumLineWidth(width) {
    this.gridMediumLineWidth = Math.max(0.25, Math.min(5, Number(width)));
    this._updateGridAppearance();
  }

  /**
   * Set the width of major grid lines (every 10th).
   * @param {number} width - Stroke width in pixels
   */
  setGridMajorLineWidth(width) {
    this.gridMajorLineWidth = Math.max(0.25, Math.min(5, Number(width)));
    this._updateGridAppearance();
  }

  /**
   * Set the opacity of all grid lines.
   * @param {number} opacity - Opacity value (0-1)
   */
  setGridOpacity(opacity) {
    this.gridOpacity = Math.max(0, Math.min(1, Number(opacity)));
    this._updateGridAppearance();
  }

  /**
   * Interpolate between two hex colors.
   * @param {string} color1 - Start color (e.g. '#e8f4f8')
   * @param {string} color2 - End color (e.g. '#ffffff')
   * @param {number} t - Blend factor (0-1; 0 returns color1, 1 returns color2)
   * @returns {string} Interpolated color as hex string
   * @private
   */
  _blendColors(color1, color2, t) {
    t = Math.max(0, Math.min(1, Number(t)));
    
    // Parse hex colors
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);
    
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);
    
    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    
    // Return as hex
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Set the background white level (0-100 blend from light blue to white).
   * @param {number} level - White level (0-100; 0=light blue #e8f4f8, 100=white #ffffff)
   */
  setBackgroundWhiteLevel(level) {
    this.backgroundWhiteLevel = Math.max(0, Math.min(100, Number(level)));
    
    // Calculate blend factor (0-1)
    const t = this.backgroundWhiteLevel / 100;
    const color = this._blendColors('#e8f4f8', '#ffffff', t);
    
    // Update SVG background color
    if (this.svg) {
      this.svg.attr('style', `border: 1px solid #ccc; background: ${color};`);
    }
  }

  /**
   * Destroy the visualization and clean up.
   */
  destroy() {
    if (this.simulation) {
      this.simulation.stop();
    }
    d3.select(`#${this.containerId}`).selectAll('*').remove();
  }
}

export { ForceDirectedVisualization };
