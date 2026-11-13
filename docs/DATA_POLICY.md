# PhyloExplorer — Data Policy

## 1. Scientific Data Integrity

PhyloExplorer is built on the principle that evolutionary science requires precise, verifiable, and transparent data. This document defines how scientific data is curated, validated, represented, and licensed.

### 1.1 Core Principles

**No Fabrication**
- Every phylogenetic relationship, taxon name, divergence estimate, and external reference comes from a published, peer-reviewed source or a documented public database.
- No synthetic relationships or invented data are included, even if they seem reasonable or fill perceived gaps.
- Absence of data is explicitly acknowledged, not filled with guesses.

**No Silent Averaging or Selection**
- When multiple published divergence estimates exist for a node, all are stored and clearly distinguished.
- The application never silently selects one estimate over another without the user's awareness.
- No averaging of conflicting estimates without explicit user consent and clear documentation of the methodology.
- Users must be able to understand why different sources yield different dates.

**Verifiable Provenance**
- Every data element has a documented source.
- Sources are cited in a machine-readable format (DOI, publication details, URL).
- Data is not used without verification that it can be legally redistributed or cited.

**Stability and Versioning**
- All taxon and node identifiers remain stable across application versions.
- Changes to the underlying data (new estimates, corrected relationships) are tracked and versioned.
- Old data versions remain accessible for reproducibility.

## 2. Taxonomic Data

Taxonomy is the authoritative reference for organism identity and formal classification. **Taxonomy is not automatically a phylogenetic tree.**

### 2.1 Representation

Taxonomic data represents formal Linnaean or modern classification, independent of evolutionary relationships:

```json
{
  "taxonomy": [
    {
      "id": "tax_homo_sapiens",
      "scientificName": "Homo sapiens",
      "commonName": "Human",
      "rank": "species",
      "parent": "tax_homo",
      "source": "ITIS",
      "sourceId": "180092",
      "extinct": false
    },
    {
      "id": "tax_homo",
      "scientificName": "Homo",
      "rank": "genus",
      "parent": "tax_hominini",
      "source": "ITIS",
      "sourceId": "12345",
      "extinct": false
    }
  ],
  "metadata": {
    "source": "ITIS",
    "sourceUrl": "https://www.itis.gov/",
    "license": "Public Domain",
    "accessDate": "2024-02-01"
  }
}
```

**Key properties**:
- **Stable taxonomic identifiers**: Each organism reference has a persistent `id` prefixed `tax_` to distinguish from phylogenetic node IDs.
- **Rank field**: Any taxonomic rank from the Open Tree of Life vocabulary, including Linnaean ranks (kingdom, phylum, class, order, family, genus, species), intermediate ranks (superfamily, subfamily, tribe, subtribe, subgenus, section, subsection), mammal-specific ranks (infraclass, cohort, subcohort, superorder, suborder, infraorder, parvorder), and unranked taxa (`no rank`).
- **Parent relationship**: Links to the parent taxon in the taxonomic hierarchy.
- **Source attribution**: Documented source (Open Tree of Life, ITIS, NCBI Taxonomy, etc.).
- **Extinct flag**: Indicates whether the taxon has extant (living) representatives.

**Important distinction**: 
- A taxonomic hierarchy represents formal classification.
- A phylogenetic tree represents evolutionary hypotheses.
- They are NOT equivalent: taxonomy does not automatically describe evolutionary relationships.

### 2.2 Stable Identifiers

**Principles**:
- Internal taxon IDs are persistent identifiers independent of scientific names.
- The `id` field (e.g., `tax_homo_sapiens`) is the application's primary identifier for a taxon and never changes across application versions.
- Scientific names may change (e.g., due to taxonomic reclassification, synonym resolution, or nomenclatural changes) without changing the internal ID.
- If a taxon's scientific name or parent classification changes, the `scientificName` and `parent` fields are updated, but the `id` remains stable.
- Taxonomic reclassifications and name changes are recorded as data updates with versioning; the change is traceable and transparent.

**External identifiers**:
- ITIS IDs, NCBI Taxonomy IDs, and other external database identifiers are **source-specific references**, not the application's primary identity.
- The `sourceId` field links to an external source (e.g., `"sourceId": "180092"` is an ITIS TSN).
- External identifiers enable verification and cross-linking but are not used for internal operations.
- A taxon may be referenced in multiple external databases; the application tracks all relevant external IDs.
- External database mappings may change over time; any change is documented and the internal ID remains stable.

**Identifier scheme**:
- Prefix with `tax_` to distinguish from phylogenetic nodes.
- Use stable, descriptive naming (e.g., `tax_homo_sapiens`) based on current scientific name.
- Must be unique and persistent across application versions.
- Format must be machine-readable and URL-safe (e.g., lowercase, underscores for spaces).

### 2.3 Taxonomic Hierarchy and Ranks

**Structure**:
- Every non-root taxon has exactly one parent (single-parent hierarchy).
- The taxonomy forms a rooted tree structure, with one root taxon (e.g., "Animalia" or "Mammalia").
- Parent-child relationships represent formal taxonomic classification, not evolutionary branching.
- A taxonomic parent represents the next higher rank in the taxonomic hierarchy (e.g., species → genus → family → order, but intermediate and non-Linnaean ranks may also appear).

**Rank vocabulary**:
- The application supports all Open Tree of Life taxonomic ranks, including:
  - **Linnaean ranks**: domain, kingdom, phylum, class, order, family, genus, species, subspecies
  - **Intermediate ranks**: subphylum, superclass, subclass, superfamily, subfamily, tribe, subtribe, subgenus, section, subsection
  - **Mammal-specific ranks**: infraclass, cohort, subcohort, superorder, suborder, infraorder, parvorder
  - **Species-related groupings**: species group, species subgroup
  - **Unranked taxa**: `no rank` (for organisms without formal rank classification)
- Rank values are preserved exactly as provided by the source database; no normalization or relabeling occurs.
- The application maintains a rank hierarchy for informational purposes (enabling rank-aware operations like filtering), but **actual parent-child relationships come exclusively from the source lineage data, never from rank inference**.

**Rank hierarchy awareness**:
- The application understands the general ordering of ranks where well-established (e.g., kingdom > phylum > class > order > family > genus > species).
- However, not all ranks can be ordered relative to each other (e.g., `no rank` has undefined position).
- Applications should never infer evolutionary or taxonomic relationships from rank alone; use actual parent-child data instead.

**Valid assumptions**:
- The taxonomy is a rooted tree, not a forest: there is exactly one root node with `parentId: null`.
- There are no cycles: the parent chain from any taxon leads to the unique root.
- Every taxon has a rank value (possibly `no rank`).
- Rank values are non-empty strings and are preserved exactly as provided by the source.

**Validation**:
- On data load, verify that all parent references exist.
- Verify that the hierarchy is acyclic (no circular dependencies).
- Verify that each non-root taxon has exactly one parent.
- Identify and report any orphaned taxa (invalid parent IDs).
- Report errors explicitly; never silently ignore invalid relationships.

## 3. Phylogenetic Hypotheses

A phylogenetic hypothesis is a rooted tree representing a published evolutionary hypothesis. It is separate from taxonomy. Terminals in the tree reference taxonomic identifiers; internal nodes are hypothesis-specific.

### 3.1 Phylogenetic Tree Structure

```json
{
  "hypothesisId": "phylo_hypothesis-001",
  "hypothesisName": "Example Mammalian Phylogeny",
  "source": "doi:10.1234/example",
  "rootNodeId": "ancestor_h1_n0",
  "nodes": [
    {
      "id": "ancestor_h1_n0",
      "type": "internal",
      "parentId": null,
      "children": ["ancestor_h1_n1", "ancestor_h1_n2"]
    },
    {
      "id": "ancestor_h1_n1",
      "type": "internal",
      "parentId": "ancestor_h1_n0",
      "children": ["tax_homo_sapiens", "ancestor_h1_n3"]
    },
    {
      "id": "tax_homo_sapiens",
      "type": "terminal",
      "parentId": "ancestor_h1_n1",
      "children": [],
      "taxonId": "tax_homo_sapiens"
    }
  ]
}
```

**Key properties**:
- **Hypothesis scoping**: All internal node IDs are scoped to the hypothesis (prefix: `ancestor_h1_`, `ancestor_h2_`, etc.).
- **Terminal nodes**: Type "terminal" references a taxon from the taxonomy via `taxonId`.
- **Internal nodes**: Type "internal" represents an ancestor with no corresponding formal taxon.
- **Parent-child edges**: Define the tree topology.
- **Assumption**: A phylogenetic tree is a published hypothesis, not an observed fact.

### 3.2 Multiple Hypotheses

The architecture supports loading multiple phylogenetic hypotheses simultaneously (planned for future releases):
- Each hypothesis has its own `hypothesisId`.
- Internal node IDs are unique within a hypothesis but may be reused across hypotheses.
- Terminal node references (taxonomic IDs) are consistent across hypotheses.
- MRCA computations and operations work within a single hypothesis at a time.
- Different hypotheses may propose different evolutionary relationships; they are never silently combined.

## 4. Divergence Estimates

### 4.1 Structure and Binding

Divergence estimates are associated with specific internal nodes in specific hypotheses. Multiple independent estimates are preserved without averaging:

```json
{
  "estimates": [
    {
      "hypothesisId": "phylo_hypothesis-001",
      "nodeId": "ancestor_h1_n0",
      "estimates": [
        {
          "sourceId": "source_example-2024",
          "centralEstimate": 6.0,
          "statisticType": "mean",
          "uncertaintyLower": 5.3,
          "uncertaintyUpper": 6.7,
          "uncertaintyType": "95% credible interval",
          "unit": "Ma",
          "methodology": "Bayesian phylogenetic inference",
          "calibrationNotes": "Example estimate for schema illustration",
          "source": "doi:10.1234/example",
          "estimateDate": "2024-02-01"
        }
      ]
    }
  ],
  "sourceMetadata": {
    "source_example-2024": {
      "type": "example",
      "title": "Example Publication",
      "authors": "Example Author",
      "year": 2024,
      "doi": "10.1234/example",
      "license": "Example License",
      "redistributionAllowed": false,
      "notes": "This is a FICTIONAL example for schema documentation only"
    }
  }
}
```

**Key properties**:
- **Hypothesis-node binding**: Each estimate is explicitly linked to a hypothesis ID and node ID.
- **No silent defaults**: If no estimate exists for a node, the application reports this explicitly.
- **Statistic type**: Clarifies whether central estimate is mean, median, mode, etc.
- **Uncertainty specification**: Both bounds and type are explicit; no invented bounds.
- **Source tracking**: Every estimate references source metadata with publication and methodology details.
- **No averaging**: Conflicting estimates are preserved for user selection.

### 4.2 Representation of Divergence Time

A divergence time estimate includes:
- **Central estimate (Ma)**: Point estimate, mean, or median divergence time.
- **Statistic type**: What the central estimate represents ("mean", "median", "mode", "point estimate", etc.).
- **Uncertainty bounds**: Lower and upper bounds of confidence or credible interval (optional; may be null).
- **Uncertainty type**: Description of the interval ("95% credible interval", "95% confidence interval", "1 standard error", etc.).
- **Methodology**: How the estimate was derived (e.g., "Bayesian molecular clock", "penalized likelihood", "minimum age constraint").
- **Calibration notes**: Fossil constraints, taxon sampling, or other methodological considerations.
- **Source**: DOI, publication reference, or stable identifier.
- **Estimate date**: When the estimate was recorded in our dataset (for tracking dataset versions).

### 4.3 Distinct Temporal Concepts

The application rigorously distinguishes:

- **Divergence time**: Estimated time of lineage splitting (associated with internal nodes in a phylogenetic tree). Represents the hypothesis's prediction of when speciation occurred. Subject to all uncertainties in molecular clocks, fossil calibrations, and phylogenetic inference.

- **Taxon origin**: When a particular species, genus, or taxon first appeared. May come from fossil records or molecular estimates. Different from divergence time and not automatically derivable from it.

- **First fossil occurrence**: Oldest known fossil record of a taxon. Provides a minimum-age constraint on the taxon's existence (the taxon must have existed at or before this fossil). Generally more recent (younger) than both taxon origin and divergence times, but this relationship is not universally guaranteed; the geological record is incomplete. Empirical observation, not an evolutionary estimate. No universal temporal ordering is assumed between a single fossil occurrence and every divergence estimate or taxon origin date.

- **Branch length**: Duration a lineage persists; elapsed time from origin to termination (or present). Different from divergence time.

**Important**: These concepts must never be conflated, silently converted, or interchangeably displayed. Each represents different information about evolution. Taxon origin must never be used as a substitute for a divergence time estimate.

**Why this distinction matters**:
- Divergence date = evolutionary prediction based on molecular or comparative data.
- Taxon origin = the point when the taxon can be recognized as distinct.
- First fossil = empirical observation; minimum age constraint; generally younger but incompleteness prevents certainty.

These three dates provide different information and should never be conflated or used interchangeably.

## 4. Source Metadata

Every divergence estimate, taxon relationship, and data item is linked to a documented source:

**FICTIONAL EXAMPLE for schema documentation**:
```json
{
  "sourceMetadata": {
    "source_example-2024": {
      "type": "FICTIONAL EXAMPLE - not a real journal article",
      "title": "FICTIONAL EXAMPLE: Example Phylogenetic Study of Mammals",
      "authors": "Example, A., Fiction, B., & Schema, C.",
      "journal": "FICTIONAL Journal",
      "year": 2024,
      "volume": 1,
      "issue": 1,
      "doi": "doi:10.1234/example.fictional",
      "pubmedId": "N/A (FICTIONAL)",
      "url": "FICTIONAL (not a real URL)",
      "license": "FICTIONAL - if real, would be CC-BY-4.0",
      "redistributionAllowed": false,
      "accessDate": "FICTIONAL",
      "notes": "THIS IS A FICTIONAL EXAMPLE FOR SCHEMA DOCUMENTATION ONLY. Do not use as a real source."
    },
    "source_real-example": {
      "type": "database",
      "title": "Example Real Database (PLACEHOLDER - verify before use)",
      "authors": "Example Organization",
      "year": 2024,
      "url": "https://example.org/database (PLACEHOLDER URL)",
      "license": "MUST BE VERIFIED BEFORE USE",
      "redistributionAllowed": false,
      "accessDate": "WOULD BE FILLED IN WHEN REAL DATA IS ACQUIRED",
      "notes": "This shows the structure for real data; all values must be verified against actual source before inclusion."
    }
  }
}
```

**Real metadata requirements** (when using actual sources):

Verify redistribution rights before completing these fields. Do not assert `redistributionAllowed: true` without confirmation from the source's license or terms of use. If unsure, assume false and contact the source authors for permission.

```json
{
  "sourceMetadata": {
    "source_id": {
      "type": "VERIFIED: journal article / book / database / preprint / conference paper / etc.",
      "title": "Full title of the source",
      "authors": "Author names (may be omitted for databases)",
      "year": 2024,
      "doi": "Persistent DOI if available",
      "url": "https://Permanent URL to source (not a shortened link)",
      "license": "Verified license from source (e.g., CC-BY-4.0, Public Domain, Copyright with permission)",
      "redistributionAllowed": false,
      "redistributionNotes": "If true: Explain what rights are granted. If false: Explain restrictions and how the data can be used.",
      "accessDate": "YYYY-MM-DD when source was accessed",
      "notes": "Brief description of how this source is used in PhyloExplorer"
    }
  }
}
```

**Required metadata fields**:
- **type**: "journal article", "book", "database", "preprint", "conference paper", etc.
- **title**: Full title of the source.
- **authors**: Author names (may be omitted for databases).
- **year**: Publication year.
- **doi** or **url**: A persistent identifier or URL for accessing the source.
- **license**: The verified license under which the data is published.
- **redistributionAllowed**: Boolean. Must be verified against actual source license before setting to true.
- **redistributionNotes**: Explanation of redistribution rights and any conditions.
- **accessDate**: When the data was downloaded or imported.

**No unverified permission claims**:
- Before including any data from an external source, verify that:
  - The license permits redistribution.
  - The data is not proprietary or requires special permission.
  - Any required attribution is documented and will be preserved.

**API data requires local bundling**:
- If data is initially sourced from an API (e.g., phylopic.org), it is downloaded, cached locally, and included in the repository.
- The application does not make live API calls for essential functionality; all data is static and bundled.

## 5. PhyloPic Attribution

PhyloPic (www.phylopic.org) provides silhouettes of animals for educational and scientific use. If PhyloExplorer includes PhyloPic images, the following requirements apply:

### 5.1 Licensing
- PhyloPic silhouettes are typically licensed under Creative Commons (CC-BY-3.0, CC-BY-NC-3.0, or similar).
- Before use, verify the specific license of each silhouette.
- Only use silhouettes with licenses that permit redistribution in a web application.

### 5.2 Attribution
- Every PhyloPic silhouette must include clear attribution to the artist.
- Attribution format: "Silhouette of [Animal] by [Artist Name] ([License])"
- This attribution is displayed in the UI alongside the image and in the source metadata.

### 5.3 Data Structure
- PhyloPic associations are stored separately from taxonomic data.
- If a silhouette is unavailable or removed, the application gracefully falls back to a generic icon or no image.
- PhyloPic integration is deferred to a future milestone if necessary to meet initial release goals.

## 6. External References

Taxon details include links to reliable external resources:

```json
{
  "externalReferences": {
    "itis": "https://www.itis.gov/servlet/SingleRpt/SingleRpt?search_topic=TSN&search_value=...",
    "ncbi-taxonomy": "https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=...",
    "wikidata": "https://www.wikidata.org/wiki/Q...",
    "phylopic-organism": "http://phylopic.org/api/a/organisms/...",
    "wikipedia": "https://en.wikipedia.org/wiki/...",
    "worldwidewildlife": "https://www.worldwildlifefund.org/..."
  }
}
```

**Verified sources only**:
- Links point to reputable, stable sources (ITIS, NCBI, Wikidata, PhyloPic, Wikipedia).
- No links to personal websites or non-authoritative sources without strong justification.
- Dead or unreliable links are removed or corrected during maintenance.

## 7. Validation and Quality Assurance

### 7.1 Data Validation at Load Time

When the application loads, it validates all data:

```javascript
function validateTaxonomyData(data) {
  // Check that all taxa and ancestors have unique IDs
  // Verify all parentId references exist
  // Check for cycles
  // Validate that extinct flag is boolean
  // Verify that type field is recognized
  // Report detailed errors
}

function validateDivergenceEstimates(data, taxonomy) {
  // Check that all nodeIds exist
  // Verify that divergence times are positive numbers
  // Validate that uncertainty ranges make sense
  // Check that all sourceIds have metadata
  // Verify Ma units
}
```

**Error handling**:
- If validation fails, the application reports the error explicitly (in console and UI).
- The application does not load with invalid data; it stops and asks the user to report the issue.
- Invalid data is never silently ignored or auto-corrected.

### 7.2 Schema Validation

A JSON Schema file defines the expected structure of all data files:

```
/data/schemas/
  taxonomy.schema.json
  divergence-estimates.schema.json
  source-metadata.schema.json
```

On data import, files are validated against their schema. Non-conforming data is rejected.

### 7.3 Peer Review and Curation

Before a new dataset is added to PhyloExplorer:
1. The source publication is reviewed to ensure credibility.
2. The data is extracted and formatted carefully.
3. The data is validated against the schema.
4. A brief summary of the data and its source is added to the documentation.
5. The addition is reviewed by a project contributor (before initial release, this may be a single researcher; later, by community review).

## 8. Versioning and Updates

### 8.1 Data Versions

The `/data` directory includes a `version.json` file:

```json
{
  "version": "1.0.0",
  "releaseDate": "2024-06-15",
  "mammalianSpeciesCovered": 247,
  "divergenceEstimatesSources": ["dos-reis-2018", "ITIS-2024"],
  "changes": [
    "Initial release with 247 mammalian species",
    "Divergence estimates from dos Reis et al. 2018",
    "Taxonomic relationships from ITIS 2024"
  ],
  "previousVersions": ["0.1.0", "0.0.1"]
}
```

### 8.2 Data Updates

When divergence estimates are updated or corrected:
- A new version is created with a changelog.
- Old versions remain accessible (archived).
- Users are notified of significant changes.
- The application can optionally show which version of the data is being used.

## 9. Community Contribution

PhyloExplorer is open to community contributions of:
- Corrected relationships or taxonomy.
- New divergence estimates from peer-reviewed sources.
- Improved external references.
- New taxa or expanded groups.

**Contribution requirements**:
- All contributions must include source documentation.
- All data must be verifiable and from published sources.
- Contributions are reviewed before inclusion.
- Contributors are credited in the source metadata and documentation.

## 10. Out-of-Scope Data

The following are explicitly out of scope and will not be included without major approval:

- **Invented or speculative relationships**: Hypothetical trees that are not published.
- **Personal communications**: Unpublished data, even if from experts.
- **Silently averaged estimates**: No averaging without explicit user control.
- **Unlicensed or proprietary data**: Data that cannot be legally redistributed.
- **Unverified external APIs**: The application does not depend on live external services.

## 11. Summary

PhyloExplorer's data architecture prioritizes:
- **Scientific accuracy**: All data comes from published sources.
- **Transparency**: Sources and methodologies are documented and visible.
- **Integrity**: No fabrication, averaging, or silent omissions.
- **Reproducibility**: Data is versioned and stable.
- **Respect for intellectual property**: Proper licensing and attribution.

This policy ensures that PhyloExplorer remains a trustworthy tool for scientific education and research.
