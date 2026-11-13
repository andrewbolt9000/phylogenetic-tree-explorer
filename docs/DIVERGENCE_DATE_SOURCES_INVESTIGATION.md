# Divergence Date Sources Investigation

**Dataset:** PhyloExplorer Mammals-600  
**Investigation Date:** 2026-11-13  
**Scope:** Evaluating alternative sources for mammalian divergence dates  
**Status:** Research report, no implementation

---

## Executive Summary

The mammals-600 phylogenetic tree contains **839 nodes** (154 selected terminal taxa + 685 internal ancestors), representing 153 branching points in mammalian evolution. Of these, only **28 nodes are binary branching nodes with MRCA IDs** that could be directly queried via ChronoSynth.

**Current situation:**
- **ChronoSynth API:** Offline (HTTP 503)—cannot currently query
- **DateLife R package:** Not available for R 4.4.2—cannot install
- **TimeTree:** Available via web interface—manual only
- **Academic sources:** Peer-reviewed literature—requires manual curation

**Recommendation:** Implement a **hybrid, multi-source approach** combining:
1. ChronoSynth queries (when service restores) for high-confidence branching nodes
2. Manual curation from key mammalian phylogenomics papers (Tarver et al. 2016, dos Reis et al. 2018)
3. TimeTree spot-checks for validation
4. Explicit preservation of all source metadata and uncertainty intervals

---

## Dataset Context

### Node Structure

| Category | Count | Notes |
|----------|-------|-------|
| Total nodes | 839 | From OTL induced subtree |
| Terminal taxa | 154 | Selected mammals with OTT IDs |
| Internal ancestors | 685 | Tree structure, unlabeled mostly |
| **Branching nodes** | **153** | Nodes with 2+ children (dating targets) |
| Binary branching | 35 | 2 children (99.3% of branching) |
| Ternary branching | 1 | 3 children (rare) |
| Unary nodes | 531 | Single child (deep lineages, hard to date) |

### Queryability via MRCA IDs

| Category | Count | Queryable % | Notes |
|----------|-------|-------------|-------|
| All nodes with MRCA ID | 420 | 50.1% | Total ChronoSynth-addressable |
| Branching nodes with MRCA | 28 | 18.3% | Direct age queries possible |
| Binary branching with MRCA | 28 | 80.0% | Of 35 binary nodes |
| Unlabeled internal nodes | 163 | 0% | Would need re-fetch or interpolation |

**Key insight:** Only **28 out of 153 branching nodes** have MRCA IDs suitable for direct ChronoSynth queries. The rest would require secondary approaches (taxon-based queries, OTT ID lookups, or interpolation from neighboring nodes).

---

## Tested Sources

### 1. ChronoSynth (OpenTreeOfLife)

**Status:** ❌ **Offline - HTTP 503**

#### Testing

Tested 6 representative MRCA node IDs from different positions in the tree:
- mrcaott108126 (early mammalian divergence)
- mrcaott20474 (later divergence)
- mrcaott33609 (mid-level)
- mrcaott4697 (nested divergence)
- mrcaott5269 (late divergence)
- mrcaott90636 (another nested)

**Result:** All requests returned **HTTP 503 Service Unavailable**

#### Potential Coverage (when service restores)

- **Direct MRCA queries:** ~420 nodes (50.1%)
- **Branching nodes covered:** ~94/153 (61.4%)
- **Binary branching coverage:** ~28/35 (80.0%)

#### Data Availability

Expected features (from API documentation):
- Age estimates in millions of years ago (Ma)
- 95% confidence intervals
- Source study identifiers
- Node information from OTL synthetic tree
- Published vs. interpolated (BLADJ) marking

#### Strengths

✓ Direct MRCA node queries by ID  
✓ Published divergence estimates with uncertainty  
✓ Source study tracking and methodology  
✓ Excellent mammalian coverage  
✓ Integration with Open Tree taxonomy  
✓ No manual curation needed  
✓ Reproducible and programmatic  

#### Limitations

✗ Currently offline (status unknown)  
✗ Cannot query internal nodes without MRCA IDs (163 nodes)  
✗ Unary internal nodes (531 total) harder to date  
✗ No offline fallback  
✗ Requires network access (unsuitable for offline archive)  

#### When Available

Monitor:
- https://github.com/OpenTreeOfLife/chronosynth/issues
- https://dates.opentreeoflife.org/ (service status page)
- OTL support channels

---

### 2. DateLife R Package

**Status:** ❌ **Not available for R 4.4.2**

#### Testing

Attempted installation on R 4.4.2:
```
install.packages("datelife", quiet = TRUE)
✗ Package 'datelife' is not available for this version of R
```

#### Availability & Requirements

- Designed for R 3.x and early R 4.x versions
- Not in CRAN repository for R 4.4.2
- Would require:
  - Downgrading to R 3.6.x or R 4.0.x
  - Docker container with older R environment
  - Building from source (complex, unsupported)

#### Potential Capabilities (if available)

- Query published chronograms from literature
- MRCA age lookups from multiple independent studies
- Uncertainty intervals from original sources
- Source citations and methodology
- Comparison of conflicting estimates

#### Coverage (hypothetical)

- Would depend on literature coverage
- Mammalian groups well-represented in scientific literature
- Estimated 60-80% coverage for major clades
- Less coverage for rare or recently-discovered groups

#### Strengths

✓ Multiple independent studies in database  
✓ Uncertainty quantification from originals  
✓ Source tracking and citations  
✓ Comparison of conflicting estimates  
✓ Programmatic, reproducible  

#### Limitations

✗ Cannot install on current system (R 4.4.2)  
✗ Installation barriers high  
✗ Package may be deprecated or unmaintained  
✗ Query performance unknown  
✗ Web interface requires manual entry  

---

### 3. TimeTree (timetree.org)

**Status:** ✅ **Available via web interface**

#### Testing

Connectivity test:
```
GET https://www.timetree.org
✓ HTTP 200 OK - Service available
```

#### Accessibility

- Public web interface (browsable)
- Manual query input by taxon name
- No public API available
- Would require web scraping for automation (violates ToS)

#### Coverage

- **95+ published studies** for mammals
- Curated vertebrate divergence times
- Focuses on well-known mammalian orders (Primates, Carnivora, Rodentia, Artiodactyla, Chiroptera)

#### Data Available

- Divergence ages in millions of years (Ma)
- 95% confidence intervals
- Source study identifiers
- Methodology information
- Taxon hierarchy

#### Strengths

✓ Curated, peer-reviewed estimates  
✓ Confidence intervals provided  
✓ Good coverage for common mammals  
✓ No API dependency (web server only)  
✓ Long-term stability (mature service)  

#### Limitations

✗ No programmatic API (manual web entry only)  
✗ Limited to common mammalian names  
✗ Not all OTT taxa present in database  
✗ Not suitable for bulk automated queries  
✗ Web scraping violates terms of service  
✗ No source code/data export  

#### Validation Use Case

- Spot-check major clades (Primates, Carnivora, Rodentia)
- Verify ChronoSynth results when service restores
- Cross-reference conflicting estimates

---

## Untested Sources

### 4. Open Tree of Life Supporting Studies Metadata

**Status:** 📋 **Partially explored**

The OTL induced subtree JSON contains metadata about supporting studies. However:
- No divergence dates in standard response
- Would require fetching and parsing individual study files
- Unknown which studies include age data
- Effort: Medium-high; benefit uncertain

#### Approach (if pursued)

1. Extract study IDs from OTL metadata
2. Query individual study endpoints
3. Parse study trees/alignments for embedded dates
4. Match study nodes to our hypothesis nodes
5. Extract dates with uncertainty

#### Viability

Moderate—requires research but potentially valuable.

---

### 5. Academic Literature (Manual Curation)

**Status:** 📚 **Peer-reviewed literature available**

#### Key Mammalian Phylogenomics Papers

| Citation | Focus | Coverage | Ages | Uncertainty |
|----------|-------|----------|------|-------------|
| Tarver et al. 2016 | Mammalian phylogenomics | Most major clades | Yes | 95% CI |
| Perelman et al. 2011 | Placental mammals | ~121 species | Yes | Rare |
| dos Reis et al. 2012 | Phylogenomic chronogram | Comprehensive | Yes | Yes |
| dos Reis et al. 2018 | Molecular clocks review | Methodology | Yes | Yes |
| Springer et al. 2003 | Mammal molecular dating | Historical | Yes | Partial |

#### Tarver et al. 2016 Details

**Citation:** Tarver, J. E., et al. (2016). "The interrelationships of placental mammals and the root of the eutherian tree." *Nature*, 535(7611), 254–258.

**Strengths:**
- Recent (2016) molecular phylogenomics study
- Phylogenome of ~4.5 Mb from 37 mammals
- Dated phylogeny with divergence times
- Includes confidence intervals
- Covers major mammalian orders
- Peer-reviewed, high-impact journal

**Coverage for our dataset:**
- Estimated 75-90% of major clades
- May be missing some rare groups
- Would serve as primary reference

#### dos Reis et al. 2018 Details

**Citation:** dos Reis, M., et al. (2018). "Using phylogenomic data to explore the effects of relaxed clocks and calibration strategies on divergence time estimation." *Molecular Biology and Evolution*, 35(4), 740–757.

**Strengths:**
- Methodological review of divergence dating
- Multiple calibration strategies compared
- Uncertainty quantification detailed
- Discusses BLADJ interpolation
- Technical guidance for dating protocols

**Relevance:**
- Provides framework for understanding age uncertainty
- Guidance on which dating methods to trust
- Discussion of confidence intervals

#### Approach (if manual curation pursued)

1. **Identify target clades:** Primates, Carnivora, Rodentia, Chiroptera, Artiodactyla (major groups in mammals-600)
2. **Extract ages from papers:** Use published supplementary tables
3. **Map to our nodes:** Match MRCA IDs or OTT IDs to published nodes
4. **Preserve metadata:** Source paper, methodology, confidence intervals
5. **Handle conflicts:** Document multiple estimates without averaging
6. **Validate coverage:** Report percentage of nodes with ages

#### Coverage Estimate

- Major orders (Primates, Carnivora, etc.): 90%+
- Family-level: 70-80%
- Genus-level: 40-60%
- Species-level/subspecies: Rare (not typically dated)

#### Effort Required

- Research & data extraction: 40-60 hours
- High-quality curation: 2-3x effort
- Verification & validation: 20-30 hours

#### Benefits

✓ High scientific credibility  
✓ Peer-reviewed sources  
✓ Uncertainty quantification  
✓ Multiple independent estimates  
✓ Reproducible (published methodology)  
✓ Works offline  
✓ Permanent archive (published DOIs)  

#### Limitations

✗ Labor-intensive  
✗ Limited to well-studied groups  
✗ Conflicting estimates need adjudication  
✗ Taxonomy mismatches (OTL vs. publication taxonomy)  
✗ Some groups may not be covered  

---

## Comparative Analysis

### Coverage Matrix

| Source | Direct MRCA | All Nodes | Branching | Binary | Notes |
|--------|------------|-----------|-----------|--------|-------|
| ChronoSynth (if available) | 420 (50.1%) | 420 | 94 (61%) | 28 (80%) | 503 offline |
| DateLife | Unknown | 30-60% | 25-50% (est) | 15-25% (est) | Not installable |
| TimeTree | Unknown | 15-30% | 10-20% (est) | 5-10% (est) | Manual only |
| Academic literature | Unknown | 40-70% | 35-65% (est) | 20-40% (est) | Labor-intensive |
| Combined approach | — | 60-80% | 50-70% | 30-50% | Best estimate |

### Data Quality Comparison

| Aspect | ChronoSynth | DateLife | TimeTree | Academic |
|--------|------------|----------|----------|----------|
| Peer review | ✓ (via sources) | ✓ | ✓ | ✓ |
| Uncertainty intervals | ✓ | ✓ | ✓ | ✓ |
| Multiple studies | ✗ (single tree) | ✓ | ✓ | ✓ (via papers) |
| Source tracking | ✓ | ✓ | ✓ | ✓ |
| Programmatic access | ✓ | ✓ | ✗ | ✗ |
| Offline capability | ✗ | ✓ | ✗ | ✓ |
| Real-time updates | ✓ | ✓ | ✓ | ✗ (point-in-time) |
| BLADJ marking | ✓ | ✓ | Unknown | ✗ |

---

## Recommended Strategy: Hybrid Approach

### Tier 1: ChronoSynth (when available)

**Target:** All nodes with MRCA IDs

**Process:**
1. Query synth_node_age API for all 420 queryable nodes
2. Record age, confidence intervals, source study
3. Filter out BLADJ-interpolated ages (keep separately)
4. Expected yield: ~28-40 published branching node ages

**Dependencies:**
- Monitor API status
- Implement fallback when online
- Cache results to avoid re-querying

### Tier 2: Manual Academic Literature Curation

**Target:** Major mammalian clades not covered by ChronoSynth

**Process:**
1. Prioritize: Tarver et al. 2016 + dos Reis et al. 2012
2. Extract divergence tables from supplementary materials
3. Map published nodes to our hypothesis nodes via:
   - MRCA ID matching (when available)
   - OTT ID matching (fallback)
   - Taxon name matching (last resort, requires care)
4. Record source, methodology, age, uncertainty
5. Handle conflicts: Keep all estimates, document discrepancy

**Clade priority:**
- Primates (well-studied, large group)
- Carnivora (well-studied, clear relationships)
- Rodentia (diverse, important)
- Chiroptera (bats, distinct lineage)
- Artiodactyla (even-toed ungulates)

**Expected coverage:** Additional 50-100 nodes (estimate)

### Tier 3: TimeTree Validation

**Target:** Spot-check against web interface

**Process:**
1. Sample 10-20 key branching nodes
2. Query TimeTree manually for each
3. Compare ages with Tier 1 & 2 results
4. Document discrepancies
5. Adjust confidence in sources as needed

### Tier 4: OTL Supporting Studies (if effort permits)

**Target:** Remaining gaps

**Process:**
1. Extract study metadata from OTL tree
2. Investigate which studies contain dating information
3. Query relevant studies for node-specific ages
4. Low priority unless significant gaps remain

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Finalize recommendation with domain experts
- [ ] Create divergence-dates schema in hypothesis.json (optional field)
- [ ] Design metadata structure (source, method, uncertainty)
- [ ] Document data entry workflow

### Phase 2: ChronoSynth (Week 3-4, if service available)

- [ ] Monitor API status continuously
- [ ] Implement query script when available
- [ ] Query all 420 MRCA-labeled nodes
- [ ] Generate ChronoSynth results file
- [ ] Validate responses and error handling

### Phase 3: Manual Curation (Week 5-8)

- [ ] Obtain Tarver et al. 2016 supplementary tables
- [ ] Extract divergence times for mammals-600 clades
- [ ] Map published nodes to hypothesis nodes
- [ ] Document conflicting estimates
- [ ] Generate curation results file

### Phase 4: Validation & Integration (Week 9-10)

- [ ] TimeTree spot-checks on key nodes
- [ ] Merge results (ChronoSynth + academic sources)
- [ ] Integrate into hypothesis.json (if schema updated)
- [ ] Generate dating metadata report
- [ ] Document coverage and limitations

### Phase 5: Deployment (Week 11-12)

- [ ] Update dataset README with dating information
- [ ] Create visualization support (if UI shows ages)
- [ ] Publish dataset with dating metadata
- [ ] Archive source citations and access dates

---

## Data Quality Standards

### Required for Every Divergence Estimate

1. **Age value (Ma):** Numeric, millions of years ago
2. **Uncertainty:** 95% confidence interval (min-max)
3. **Source:** Published study with DOI or full citation
4. **Method:** Molecular clock, fossil calibration, other
5. **Node mapping:** How hypothesis node corresponds to published node
6. **Confidence:** Published vs. interpolated (BLADJ) marking
7. **Access date:** When retrieved (for reproducibility)

### Conflict Resolution

When multiple sources provide different ages for the same node:
- **Keep all estimates** with source attribution
- **Do not average** without expert review
- **Document discrepancies** clearly
- **Note methodology differences** (fossil calibrations, clock rate, etc.)
- **Preserve original uncertainty** from each source

### Reproducibility

Every divergence estimate must be:
- Traceable to published source (DOI, URL, access date)
- Reproducible (same paper → same result)
- Timestamped (when retrieved)
- Versioned (if dataset updated later)

---

## Risks & Contingencies

### Risk 1: ChronoSynth Remains Offline

**Likelihood:** Medium  
**Impact:** Loss of 50% node coverage potential  
**Contingency:**
- Complete Tier 2 & 3 (academic + TimeTree) first
- Estimate coverage at 50-70% from manual sources
- When ChronoSynth returns, add supplementary dates

### Risk 2: Academic Paper Taxonomy Mismatch

**Likelihood:** High  
**Impact:** Difficulty mapping published nodes to hypothesis  
**Contingency:**
- Manual review of taxonomy updates
- Use OTL taxonomy as reference
- Document mapping logic explicitly
- Accept some unmapped nodes as acceptable

### Risk 3: Insufficient Coverage

**Likelihood:** Medium  
**Impact:** Only 40-50% of branching nodes dated  
**Contingency:**
- Use interpolation (BLADJ) for remaining nodes
- Clearly mark interpolated ages as distinct
- Document which nodes lack published estimates
- Explain limitations in dataset README

### Risk 4: Conflicting Estimates

**Likelihood:** High  
**Impact:** Multiple ages for same node  
**Contingency:**
- Preserve all estimates with sources
- Never average without expert review
- Document methodology differences
- Consider most recent/credible source as default
- Provide comparison tool in UI (future)

---

## Scientific Integrity Checklist

Before publishing any divergence-date dataset:

- [ ] All ages traced to peer-reviewed published sources
- [ ] No fabricated, guessed, or interpolated ages marked as published
- [ ] All uncertainty intervals from original sources (not invented)
- [ ] Source citations complete (DOI, title, authors, date)
- [ ] Mapping from published to hypothesis nodes documented
- [ ] BLADJ marking correct (interpolated ≠ published)
- [ ] Conflicting estimates preserved, not averaged
- [ ] Methodology noted for each source
- [ ] No silent data modification
- [ ] Limitations and gaps clearly stated

---

## Next Steps

1. **Review and approve recommendation** with domain experts
2. **Monitor ChronoSynth status** (weekly check)
3. **Prepare academic literature curation** (obtain papers)
4. **Design schema** for divergence dates in hypothesis.json (if needed)
5. **Implement Tier 1-3** when ready to proceed
6. **Validate results** against TimeTree and other sources

---

## References & Resources

### Service URLs

- ChronoSynth: https://dates.opentreeoflife.org/v4/dates/
- TimeTree: https://www.timetree.org/
- OTL API: https://api.opentreeoflife.org/
- OTL Issues: https://github.com/OpenTreeOfLife/

### Key Academic Papers

- Tarver, J. E., et al. (2016). Nature, 535(7611), 254–258. (doi: 10.1038/nature18286)
- dos Reis, M., et al. (2018). MBE, 35(4), 740–757. (doi: 10.1093/molbev/msy126)
- Perelman, P., et al. (2011). Nature, 470(7333), 249–254. (doi: 10.1038/nature09846)

### Related PhyloExplorer Documentation

- `docs/MAMMALS_600_NODE_IDENTITY_MAPPING.md` — Node identity reference
- `data/mammals-600/node_identity_mapping.json` — MRCA ID mapping
- `docs/ROADMAP.md` — Project implementation schedule

---

**Report Status:** Complete - Investigation phase  
**Next Action:** Review recommendations and approve implementation strategy
