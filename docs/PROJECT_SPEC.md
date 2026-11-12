# PhyloExplorer — Project Specification

## 1. Overview

PhyloExplorer is a static, browser-based application for exploring mammalian evolutionary relationships through interactive phylogenetic trees. The application enables scientists, educators, and enthusiasts to understand how mammals diverged over evolutionary time and to identify evolutionary connections between contemporary and extinct species.

The initial release focuses on a single mammalian phylogenetic hypothesis. The architecture is designed to eventually support multiple published phylogenetic trees representing competing hypotheses, without silently combining or averaging them.

## 2. Core Features

### 2.1 Initial Release Features

These features are required for the first release:

#### Data Foundation
- **Taxonomic reference**: A roster of mammalian taxa (species, genera, etc.) with stable identifiers, scientific names, common names, and formal taxonomic classification.
- **Phylogenetic hypothesis**: A rooted phylogenetic tree representing a published evolutionary hypothesis, with terminal nodes referencing taxa and internal (ancestral) nodes with their own stable identifiers scoped to the hypothesis.
- **Divergence time estimates**: Multiple published estimates of divergence times for each ancestral node, with uncertainty ranges, methodology, and source citations—preserved independently without averaging or silent selection.
- **Stable identifiers**: Consistent, durable identifiers for all taxa and phylogenetic hypothesis-specific ancestral nodes that remain unchanged across application versions.

#### Primary Graph Layout: Free Force-Directed Network
- **Interactive visualization**: A force-directed graph layout of the selected phylogenetic hypothesis rendered using D3.js, with free X and Y positioning influenced by physics.
- **Parent-child integrity**: Parent-child relationships from the phylogenetic tree remain authoritative; layout calculations never modify the tree structure.
- **Pan and zoom**: Users can pan and zoom to explore the entire tree.
- **Node interaction**: Clicking or hovering on nodes reveals taxonomic information and evolutionary history.
- **Responsive performance**: Smooth interaction with 100+ nodes; performance scales with dataset size.

#### Animal Search
- **Full-text search**: Quickly find species by common name, scientific name, or partial matches.
- **Search results**: Display matching taxa with highlight and auto-zoom to the selected node.
- **Case-insensitive matching**: Support case-insensitive search for user convenience.

#### Taxonomic Information
- **Species details**: Display scientific names, common names, and taxonomic classification (family, order, etc.).
- **Divergence history**: Show the evolutionary path from the selected species to the root of the tree.
- **External references**: Links to reliable sources (e.g., Integrated Taxonomic Information System, PhyloPic organism pages).

#### MRCA (Most Recent Common Ancestor) Comparison
- **Dual selection**: Users can select two terminal taxa or species within the current phylogenetic hypothesis.
- **MRCA identification**: The application identifies their most recent common ancestor (the internal node that is the lowest common ancestor in the selected tree).
- **Divergence time display**: Show the estimated divergence time (in millions of years ago) at which the MRCA node is positioned, drawn from the user-selected divergence estimate source.
- **Uncertainty reporting**: Display uncertainty ranges (if available) for the divergence time estimate.
- **Path highlighting**: Visually highlight the evolutionary path from each selected taxon to their MRCA and the MRCA node itself.

#### Bookmarks
- **User-maintained list**: Users can bookmark favourite species or taxa of interest.
- **Persistent bookmarks**: Bookmarks are stored in browser local storage and persist across sessions.
- **Quick access**: A sidebar or menu displays bookmarked taxa for fast navigation.

#### Pruning
- **Filter to bookmarks**: Reduce the tree to show only bookmarked taxa and their common ancestors.
- **Restore full tree**: Restore the complete tree from a pruned view.
- **Preserve relationships**: Pruning preserves all ancestral relationships; no artificial nodes are introduced.

#### Deployment
- **GitHub Pages**: The application is deployed as a static site via GitHub Pages.
- **No backend required**: All data is bundled locally as JSON; no external API calls are required for core functionality.
- **Subpath support**: Asset paths work correctly when hosted at a repository subpath (e.g., `github.com/user/phylogenetic-tree-explorer/`).

### 2.2 Future Features (Post-Initial Release)

The following features are planned for future releases but are not included in the first implementation:

#### Advanced Layouts
- **Time-axis graph**: A time-calibrated 2D layout where:
  - X-coordinate is constrained by the selected divergence time estimates (millions of years ago).
  - Y-coordinate is determined by one-dimensional physics (spring forces to parent, repulsion between siblings and broader subtree spacing).
  - Nodes are positioned to minimize overlap while preserving evolutionary relationships.
  - Divergence time uncertainty can be visually represented.

#### Multiple Phylogenetic Hypotheses
- **Hypothesis selection**: Users can choose between multiple published phylogenetic hypotheses (initially one; expanded in later releases).
- **Competing topologies**: Different hypotheses may propose different evolutionary relationships; the application displays them distinctly and never silently combines them.
- **Hypothesis-scoped nodes**: Ancestral node identifiers are scoped to their hypothesis unless a verified cross-hypothesis mapping exists.
- **Cross-hypothesis taxa**: Taxonomic terminals remain consistent across hypotheses; users can track the same species across competing trees.

#### Fossil Integration
- **First appearance dates**: Mark the first known fossil occurrence of each taxon.
- **Taxon age**: Display when a taxon (species or genus) first appeared in the fossil record.
- **Extinct lineages**: Represent species that are known from fossils but no longer extant.

#### Advanced Navigation
- **Taxonomic filters**: Filter tree by order, family, or ecological trait.
- **Cladogram export**: Export selected subtrees in standard phylogenetic formats (Newick, Nexus).
- **Timeline view**: A chronological view of diversification events.

#### Media and Visualization
- **PhyloPic silhouettes**: Integrate PhyloPic SVG silhouettes for visual recognition (where available).
- **Photographs and illustrations**: Add species images with proper attribution and licensing.
- **Trait evolution**: Visualize evolution of traits across the tree.

#### Analysis Tools
- **Phylogenetic distance matrix**: Calculate pairwise evolutionary distances.
- **Subtree extraction**: Select and export arbitrary subtrees.
- **Rate analysis**: Visualize speciation and extinction rates over time.

#### Collaboration and Contribution
- **Community annotations**: Allow users to contribute alternate common names, synonyms, or corrections.
- **Version control**: Track changes to the phylogenetic data and divergence estimates.
- **Feedback integration**: Process user-submitted data improvements.

## 3. Scientific Requirements

### 3.1 Data Integrity and Source Attribution
- All phylogenetic relationships must come from published, peer-reviewed sources or documented hypotheses.
- Divergence estimates must be documented with their source publication, methodology, uncertainty ranges, and the specific ancestral node they address.
- Multiple conflicting estimates for the same node are preserved independently; no averaging or silent selection of one estimate over another.
- All taxa and phylogenetic hypothesis-specific nodes must have stable, unique identifiers that do not change between application versions.

### 3.2 Representation of Evolutionary Time

Divergence times (specifically, estimated divergence times for ancestral nodes) are stored in **millions of years ago (Ma)**. Each estimate includes:
- **Central estimate**: Point estimate, mean, or median divergence time.
- **Statistic type**: Clarification of what the central estimate represents (mean, median, mode, other).
- **Uncertainty bounds**: Lower and upper bounds of the confidence interval, credible interval, or uncertainty range (if available; may be null if the source provides no bounds).
- **Uncertainty type**: Description of the bounds (e.g., "95% credible interval", "95% confidence interval", "standard error").
- **Methodology**: How the estimate was derived (e.g., "Bayesian molecular clock with fossil calibrations").
- **Source publication**: DOI, citation, or stable identifier for the publication.
- **Source date**: When this estimate was recorded in our dataset.
- **Calibration notes**: Relevant fossil constraints, taxon sampling, or other methodological considerations.

### 3.3 Distinction Between Temporal Concepts

The application rigorously distinguishes:

- **Divergence time**: Estimated time when two lineages separated from a common ancestor. Associated with internal (ancestral) nodes in a phylogenetic tree. Represents the evolutionary hypothesis's prediction of when speciation or lineage-splitting occurred.

- **Taxon origin**: The time when a particular species, genus, or higher taxon first appeared as a distinct entity. May come from fossil records or molecular estimates. Different from divergence time and not automatically inferred from it.

- **First fossil occurrence**: The oldest known fossil evidence of a taxon. Provides a minimum-age constraint on the taxon's existence (the taxon must have existed before this fossil was formed). Generally younger than (more recent than) the true taxon origin, but this is not universally guaranteed for all taxa. Empirical observation, not an evolutionary estimate. No universal temporal ordering is assumed between a single fossil occurrence and every ancestral divergence estimate.

- **Branch length / elapsed time**: The duration a lineage persists; measured from the lineage's origin to its termination (or present day). Measured in time units (e.g., millions of years). Different from divergence time and distinct from evolutionary branch length.

- **Evolutionary branch length**: The amount of evolutionary change that occurred along a lineage, often measured in substitutions per site (molecular evolution) or in morphological changes (paleontological). Measured in units of evolutionary change, not time. A different quantity from elapsed time, even for the same branch.

These concepts must never be conflated or silently converted between one another.

### 3.4 Licensing and Attribution
- All data sources are cited; redistribution rights are verified before inclusion.
- PhyloPic images are used only with proper attribution and compliance with Creative Commons licenses.
- External data (if used) is cached locally; the application does not depend on live external services for essential functionality.

## 4. User Experience Goals

### 4.1 Accessibility
- The application is accessible to users with varying technical expertise (students, educators, researchers).
- Tooltips and help text explain evolutionary and taxonomic concepts.
- Performance is smooth on desktop and tablet devices; initial mobile support may be limited.

### 4.2 Discoverability
- The application makes it easy to find species by multiple search methods (name, common name, partial match).
- Visual highlighting and zoom focus the user's attention on relevant areas.
- The evolutionary path from any species to the root is clear and traceable.

### 4.3 Scientific Transparency
- All divergence dates and sources are explicitly visible and linked to their publications.
- Uncertainty ranges are shown when available.
- The application clearly indicates which estimates are used and why alternatives were considered.

## 5. Out of Scope

The following are explicitly out of scope for PhyloExplorer:

- **Real-time phylogenetic inference**: The application does not infer phylogenies from sequence data.
- **Backend services**: No server-side data processing, user accounts, or authentication.
- **Non-mammalian taxa** (until scheduled in future milestones).
- **Synthetic or invented data**: All relationships and dates come from published sources.
- **Continuous updates from external APIs**: Data is curated, versioned, and bundled locally.

## 6. Success Criteria

The initial release is successful when:

1. A complete mammalian phylogenetic tree is loaded and rendered correctly.
2. Users can search for species and view their details.
3. Users can select two species and identify their MRCA with divergence time.
4. Users can bookmark species and view the pruned tree containing only bookmarks and their ancestors.
5. The application is deployed on GitHub Pages and accessible to the public.
6. All scientific data has verified sources documented in the application.
7. The underlying graph model can support alternative layouts (demonstrated by the architecture).
