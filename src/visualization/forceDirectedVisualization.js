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
    this.topologyRepulsionStrength = 0;

    // Appearance parameters
    this.edgeThickness = 1.5;
    this.nodeCircleScale = 1.0;
    this.fontSizeBase = 11;

    // Silhouette offsets (in pixels, relative to node center)
    this.silhouetteXOffset = 0;
    this.silhouetteYOffset = 0;
    this.silhouetteSizePercent = 100;  // Size as percentage of default (100 = 5x node radius)
    this.silhouetteOpacity = 1.0;  // Opacity (0-1)
    this.silhouetteGrayscale = 50;  // Grayscale (0=black, 50=gray, 100=white)

    // Node date display
    this.showNodeDates = false;
    this.divergenceData = null;
    this.nodeDateLabels = null;

    // Ancestral labels display
    this.showAncestralLabels = false;
    this.hypothesisData = null;
    this.phyloGraph = null;  // Store graph for label generation
    this.ancestralLabelElements = null;
    this.rootNodeId = this.options.rootNodeId;

    // Topology-aware repulsion
    this.graphDistances = null;  // Precomputed shortest-path distances
    this.topoRepulsionForce = null;
    
    // Asset metadata for diagnostics
    this.assetMetadata = this.options.assetMetadata;
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

    // Create SVG
    this.svg = d3.select(`#${this.containerId}`)
      .append('svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height)
      .attr('style', 'border: 1px solid #ccc; background: #fafafa;');

    // Add a group for the graph content (for panning)
    this.g = this.svg.append('g');

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
        .force('center', d3.forceCenter(
          this.options.width / 2,
          this.options.height / 2))
        .alpha(1)
        .alphaDecay(0.02)
        .velocityDecay(0.4);
      
      // Add link force
      if (this.links.length > 0) {
        this.simulation.force('link', d3.forceLink(this.links)
          .id(d => d.id)
          .strength(this.currentLinkStrength));
      }
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
   * @private
   */
  _renderDateLabels() {
    if (!this.showNodeDates || !this.divergenceData) {
      const existing = this.g.selectAll('g.node-group').selectAll('text.node-date-label');
      existing.remove();
      return;
    }

    // Extract central estimate for each node from divergenceData
    const datesByNodeId = {};
    if (this.divergenceData) {
      // The DivergenceLoader returns { estimates, sourceMetadata, estimatesByHypothesis }
      // We need to use estimatesByHypothesis which has structure: hypothesisId -> nodeId -> {estimates: [...]}
      const estimatesByHypothesis = this.divergenceData.estimatesByHypothesis || {};
      
      for (const hypothesisId in estimatesByHypothesis) {
        const hypothesisEstimates = estimatesByHypothesis[hypothesisId];
        
        for (const nodeId in hypothesisEstimates) {
          const nodeData = hypothesisEstimates[nodeId];
          const nodeEstimates = nodeData.estimates || [];
          
          // Use first estimate if multiple exist
          if (Array.isArray(nodeEstimates) && nodeEstimates.length > 0) {
            const estimate = nodeEstimates[0];
            const unit = estimate.unit || 'Ma';
            datesByNodeId[nodeId] = `${estimate.centralEstimate}${unit}`;
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
        d.fx = null;
        d.fy = null;
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
   */
  setLinkStrength(strength) {
    this.currentLinkStrength = strength;
    if (this.simulation) {
      this.simulation.force('link', d3.forceLink(this.links)
        .id(d => d.id)
        .strength(strength));
      this.simulation.alpha(0.3).restart();
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
    // Silhouettes will be updated in the next tick
  }

  /**
   * Set vertical offset for silhouettes (in pixels).
   */
  setSilhouetteYOffset(offsetPixels) {
    this.silhouetteYOffset = offsetPixels;
    // Silhouettes will be updated in the next tick
  }

  /**
   * Set silhouette size as a percentage of default (100 = 5x node radius).
   */
  setSilhouetteSize(sizePercent) {
    this.silhouetteSizePercent = Math.max(30, Math.min(300, sizePercent));
    // Silhouettes will be updated in the next tick
  }

  /**
   * Set silhouette opacity (0-1).
   */
  setSilhouetteOpacity(opacity) {
    this.silhouetteOpacity = Math.max(0, Math.min(1, opacity));
    // Silhouettes will be updated in the next tick
  }

  /**
   * Set silhouette grayscale amount (0-100, 0=black, 50=gray, 100=white).
   */
  setSilhouetteGrayscale(grayscale) {
    this.silhouetteGrayscale = Math.max(0, Math.min(100, grayscale));
    // Silhouettes will be updated in the next tick
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
   */
  setShowNodeDates(show, divergenceData) {
    this.showNodeDates = show;
    this.divergenceData = divergenceData;
    this._renderDateLabels();
  }

  /**
   * Toggle display of ancestral node labels.
   */
  setShowAncestralLabels(show, hypothesisData, phyloGraph) {
    this.showAncestralLabels = show;
    this.hypothesisData = hypothesisData;
    this.phyloGraph = phyloGraph;
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
   * Set topology-aware repulsion strength and reapply the force.
   * 
   * Topology repulsion adds additional distance-based repulsion on top of
   * the ordinary D3 many-body charge force. Nodes close together in the
   * phylogenetic graph experience stronger additional repulsion.
   * 
   * @param {number} strength - Slider value (0-100), where 0 disables this force
   * @param {Object} phyloGraph - The immutable PhyloGraph object
   */
  setTopologyRepulsion(strength, phyloGraph) {
    this.topologyRepulsionStrength = strength;

    // If disabled, remove the custom force
    if (strength === 0 || !this.simulation) {
      if (this.topoRepulsionForce) {
        this.simulation.force('topoRepulsion', null);
        this.topoRepulsionForce = null;
      }
      return;
    }

    // Validate that graph was provided and has the correct API
    if (!phyloGraph || typeof phyloGraph.getNodes !== 'function') {
      console.error(
        '[PhyloExplorer] Cannot enable Topology Repulsion: invalid or missing graph object. ' +
        'Graph must be a PhyloGraph instance with getNodes(), getChildren(), and getParent() methods.'
      );
      // Disable the feature if graph is invalid
      if (this.topoRepulsionForce) {
        this.simulation.force('topoRepulsion', null);
        this.topoRepulsionForce = null;
      }
      return;
    }

    // Compute graph distances if not already cached
    if (!this.graphDistances) {
      this.graphDistances = this._computeGraphDistances(phyloGraph);
    }

    // Create a custom force that applies topology-aware repulsion
    const distances = this.graphDistances;
    const scaleFactor = strength / 100;  // Normalize slider value
    const calculateTopo = (d) => this._calculateTopoRepulsion.bind(this);

    this.topoRepulsionForce = (alpha) => {
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const a = this.nodes[i];
          const b = this.nodes[j];

          const graphDist = (distances[a.id] && distances[a.id][b.id]) || 
                           (distances[b.id] && distances[b.id][a.id]) || 
                           Infinity;

          if (graphDist === Infinity) continue;  // Not connected in graph

          // Calculate repulsion strength based on graph distance
          const repulsionStrength = this._calculateTopoRepulsion(graphDist, scaleFactor);
          if (repulsionStrength === 0) continue;

          // Calculate vector from b to a
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Avoid division by zero
          if (distance === 0) continue;

          // Apply repulsion force (push nodes apart)
          // Force magnitude decreases with pixel distance to prevent extreme effects
          const pixelDistance = Math.max(distance, 1);
          const force = repulsionStrength * alpha / pixelDistance;

          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    };

    // Update or add the force
    if (this.simulation) {
      this.simulation.force('topoRepulsion', this.topoRepulsionForce);
      this.simulation.alpha(0.3).restart();
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
