#!/usr/bin/env python3
"""
Final Tetrapods Dataset Pipeline
Builds the complete, production-ready 76-species tetrapod phylogenetic dataset.
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import logging
from Bio import Phylo

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "tetrapods"
TIME_TREE_SOURCE = ROOT / "data" / "time_tree_raw_data" / "TT6_Tetrapods.nwk"
OUTPUT_DIR = DATA_DIR / "build" / "final"
LOG_FILE = OUTPUT_DIR / "build.log"

# Import utilities
sys.path.insert(0, str(Path(__file__).parent))
from tetrapods_tree_pruner import (
    prune_tree_to_selection,
    suppress_unary_nodes,
    analyze_branching_structure,
    assign_deterministic_ids,
    check_root_to_tip_distances
)

# Setup logging
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

def load_json(path):
    """Load JSON with error handling."""
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        log.error(f"Invalid JSON in {path}: {e}")
        raise

def save_json(path, data, indent=2):
    """Save JSON with error handling."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)
        f.write("\n")
    log.info(f"Saved {path}")

def phase_1_validate_sources():
    """Phase 1: Validate source files and roster."""
    log.info("=" * 70)
    log.info("PHASE 1: Validate source files and roster")
    log.info("=" * 70)
    
    required_files = [
        DATA_DIR / "roster.json",
        DATA_DIR / "taxonomy_check_gbif.json",
        DATA_DIR / "timetree_check.json",
        DATA_DIR / "phylopic_inventory.json",
        TIME_TREE_SOURCE
    ]
    
    for path in required_files:
        if not path.exists():
            log.error(f"Missing required file: {path}")
            return False
        log.info(f"✓ Found {path.name}")
    
    try:
        roster = load_json(DATA_DIR / "roster.json")
        log.info(f"✓ Roster loaded: {len(roster['species'])} species")
        
        groups = defaultdict(int)
        for sp in roster["species"]:
            groups[sp["group"]] += 1
        for group, count in sorted(groups.items()):
            log.info(f"  - {group}: {count}")
        
        return roster
    except Exception as e:
        log.error(f"Failed to load roster: {e}")
        return False

def phase_2_parse_timetree(roster):
    """Phase 2: Parse TimeTree Newick."""
    log.info("=" * 70)
    log.info("PHASE 2: Parse TimeTree Newick")
    log.info("=" * 70)
    
    try:
        tree = Phylo.read(str(TIME_TREE_SOURCE), "newick")
        terminals = tree.get_terminals()
        log.info(f"✓ Loaded TimeTree: {len(terminals)} terminal species")
        
        label_to_terminal = {}
        for terminal in terminals:
            if terminal.name:
                label_to_terminal[terminal.name] = terminal
        
        log.info(f"✓ Built terminal label map: {len(label_to_terminal)} unique labels")
        return tree, label_to_terminal, terminals
    except Exception as e:
        log.error(f"Failed to parse TimeTree: {e}")
        return False

def phase_3_match_roster(roster, label_to_terminal):
    """Phase 3: Match roster to terminals."""
    log.info("=" * 70)
    log.info("PHASE 3: Match roster species to TimeTree terminals")
    log.info("=" * 70)
    
    timetree_data = load_json(DATA_DIR / "timetree_check.json")
    results_by_id = {r["species_id"]: r for r in timetree_data["results"]}
    
    matched = []
    unmatched = []
    
    for species in roster["species"]:
        species_id = species["id"]
        tt_record = results_by_id.get(species_id)
        
        if not tt_record or not tt_record.get("matched"):
            unmatched.append((species_id, species["scientific_name"]))
            continue
        
        expected_label = tt_record.get("expected_tree_label")
        if not expected_label or expected_label not in label_to_terminal:
            unmatched.append((species_id, species["scientific_name"]))
            continue
        
        terminal_node = label_to_terminal[expected_label]
        matched.append({
            "species_id": species_id,
            "scientific_name": species["scientific_name"],
            "common_name": species.get("common_name"),
            "group": species.get("group"),
            "newick_label": expected_label,
            "branch_length": terminal_node.branch_length or 0.0
        })
    
    log.info(f"✓ Matched: {len(matched)}/{len(roster['species'])} species")
    log.info(f"✗ Unmatched: {len(unmatched)} species")
    
    if unmatched:
        log.warning("\nUnmatched species:")
        for species_id, scientific_name in unmatched:
            log.warning(f"  - {species_id} ({scientific_name})")
    
    if not matched:
        log.error("No species matched!")
        return False
    
    return matched, unmatched

def phase_4_5_prune_and_suppress(original_tree, matched_species):
    """Phase 4-5: Prune tree and suppress unary nodes."""
    log.info("=" * 70)
    log.info("PHASE 4-5: Prune tree to selection and suppress unary nodes")
    log.info("=" * 70)
    
    selected_labels = set(sp["newick_label"] for sp in matched_species)
    
    # Step 1: Prune
    pruned_tree = prune_tree_to_selection(original_tree, selected_labels)
    
    # Step 2: Suppress unary nodes
    simplified_tree, suppressed_count = suppress_unary_nodes(pruned_tree)
    
    log.info(f"✓ Final tree: {len(simplified_tree.get_terminals())} terminals")
    
    return simplified_tree, suppressed_count

def phase_6_analyze_structure(tree):
    """Phase 6: Analyze branching structure."""
    log.info("=" * 70)
    log.info("PHASE 6: Analyze branching structure")
    log.info("=" * 70)
    
    analysis = analyze_branching_structure(tree)
    return analysis

def phase_7_assign_ids(tree, matched_species):
    """Phase 7: Assign deterministic node IDs."""
    log.info("=" * 70)
    log.info("PHASE 7: Assign deterministic node IDs")
    log.info("=" * 70)
    
    # Build mapping from newick label to species_id
    label_to_species_id = {sp["newick_label"]: sp["species_id"] for sp in matched_species}
    
    id_map, node_data = assign_deterministic_ids(tree, label_to_species_id)
    return id_map, node_data

def phase_8_build_hypothesis_json(node_data, matched_species):
    """Phase 8: Build final hypothesis.json."""
    log.info("=" * 70)
    log.info("PHASE 8: Build hypothesis.json")
    log.info("=" * 70)
    
    hypothesis = {
        "hypothesisId": "phylo_tetrapods",
        "hypothesisName": "Tetrapod Dataset - TimeTree-derived 76-species phylogeny",
        "source": "TimeTree of Life (TT6 Tetrapods)",
        "sourceMetadata": {
            "source_url": "http://www.timetree.org/",
            "methodology": "Pruned from full TimeTree to 76 selected species with exact matches",
            "pruning_date": datetime.now().isoformat()
        },
        "rootNodeId": "ancestor_phylo_tetrapods_root",
        "terminalIdPrefix": "tax_",
        "internalIdPrefix": "ancestor_phylo_tetrapods_",
        "nodes": node_data
    }
    
    log.info(f"✓ Built hypothesis with {len(node_data)} nodes")
    return hypothesis

def phase_9_build_taxonomy_json(matched_species):
    """Phase 9: Build final taxonomy.json from GBIF records."""
    log.info("=" * 70)
    log.info("PHASE 9: Build taxonomy.json from GBIF records")
    log.info("=" * 70)
    
    gbif_data = load_json(DATA_DIR / "taxonomy_check_gbif.json")
    gbif_by_id = {r["species_id"]: r for r in gbif_data.get("results", [])}
    
    taxa = []
    taxa_count = 0
    
    for species in matched_species:
        species_id = species["species_id"]
        gbif_record = gbif_by_id.get(species_id)
        
        if not gbif_record:
            log.warning(f"  No GBIF record for {species_id}")
            continue
        
        gbif_match = gbif_record.get("gbif_match", {})
        
        tax_id = f"tax_{species_id}"
        taxa.append({
            "id": tax_id,
            "scientificName": gbif_match.get("canonicalName", species["scientific_name"]),
            "commonName": species.get("common_name"),
            "rank": gbif_match.get("rank", "species").lower(),
            "parent": None,
            "source": "GBIF + TimeTree",
            "sourceId": str(gbif_match.get("usageKey", "")),
            "extinct": False,
            "notes": f"Group: {species.get('group')}"
        })
        taxa_count += 1
    
    taxonomy = {
        "taxonomy": taxa,
        "metadata": {
            "source": "GBIF (taxonomy) + TimeTree (phylogenetic placement)",
            "sourceUrl": "https://www.gbif.org/",
            "license": "CC0 (GBIF)",
            "accessDate": datetime.now().strftime("%Y-%m-%d"),
            "notes": f"{taxa_count} species from 76-species tetrapod selection"
        }
    }
    
    log.info(f"✓ Built taxonomy with {taxa_count} taxa")
    return taxonomy

def select_best_image(phylopic_record):
    """Select the best image from a phylopic record's images array.
    
    Prefers:
    1. Specific taxon matches over general
    2. Downloaded images
    3. CC0 license over CC-BY over others
    
    Returns: (image_uuid, license_url, attribution) or (None, None, None)
    """
    if not phylopic_record or not phylopic_record.get("images"):
        return None, None, None
    
    images = phylopic_record["images"]
    
    # Filter for downloaded images
    downloaded = [img for img in images if img.get("download_status") == "downloaded"]
    if not downloaded:
        downloaded = images
    
    # Sort by specificity (specific taxon first), then by license permissiveness
    def image_sort_key(img):
        is_specific = 1 if img.get("specific_taxon") else 0
        license_url = img.get("license_url", "")
        license_rank = {
            "https://creativecommons.org/publicdomain/zero/1.0/": 0,
            "https://creativecommons.org/licenses/by/4.0/": 1,
            "https://creativecommons.org/licenses/by-sa/4.0/": 2,
        }.get(license_url, 3)
        return (-is_specific, license_rank)
    
    best = sorted(downloaded, key=image_sort_key)[0]
    return (
        best.get("image_uuid"),
        best.get("license_url"),
        best.get("attribution")
    )

def phase_10_build_silhouette_mapping(matched_species):
    """Phase 10: Build silhouette-mapping.json from PhyloPic inventory."""
    log.info("=" * 70)
    log.info("PHASE 10: Build silhouette-mapping.json")
    log.info("=" * 70)
    
    phylopic_data = load_json(DATA_DIR / "phylopic_inventory.json")
    phylopic_by_id = {sp["species_id"]: sp for sp in phylopic_data.get("species", [])}
    
    mappings = {}
    mapped_count = 0
    unmapped_count = 0
    
    for species in matched_species:
        species_id = species["species_id"]
        tax_id = f"tax_{species_id}"
        phylopic_record = phylopic_by_id.get(species_id)
        
        if not phylopic_record:
            unmapped_count += 1
            continue
        
        image_uuid, license_url, attribution = select_best_image(phylopic_record)
        
        if not image_uuid:
            unmapped_count += 1
            continue
        
        mappings[tax_id] = {
            "imageUuid": image_uuid,
            "license": license_url,
            "contributor": attribution,
            "source": "PhyloPic",
            "sourceUrl": f"https://www.phylopic.org/images/{image_uuid}"
        }
        mapped_count += 1
    
    silhouette_mapping = {
        "source": "PhyloPic",
        "mappings": mappings
    }
    
    log.info(f"✓ Mapped {mapped_count} species to PhyloPic images")
    if unmapped_count > 0:
        log.warning(f"  {unmapped_count} species without qualified images")
    
    return silhouette_mapping

def main():
    """Execute full pipeline."""
    log.info(f"Starting Tetrapods Dataset Build at {datetime.now().isoformat()}")
    log.info(f"Output: {OUTPUT_DIR}\n")
    
    # Phase 1
    roster = phase_1_validate_sources()
    if not roster:
        log.error("Phase 1 failed")
        return False
    log.info("")
    
    # Phase 2
    phase_2_result = phase_2_parse_timetree(roster)
    if not phase_2_result:
        log.error("Phase 2 failed")
        return False
    original_tree, label_to_terminal, terminals = phase_2_result
    log.info("")
    
    # Phase 3
    phase_3_result = phase_3_match_roster(roster, label_to_terminal)
    if not phase_3_result:
        log.error("Phase 3 failed")
        return False
    matched, unmatched = phase_3_result
    log.info("")
    
    # Phase 4-5: Prune and suppress unary nodes
    pruned_tree, suppressed = phase_4_5_prune_and_suppress(original_tree, matched)
    log.info("")
    
    # Phase 6: Analyze structure
    analysis = phase_6_analyze_structure(pruned_tree)
    log.info("")
    
    # Phase 7: Assign IDs
    id_map, node_data = phase_7_assign_ids(pruned_tree, matched)
    log.info("")
    
    # Phase 8: Build hypothesis.json
    hypothesis = phase_8_build_hypothesis_json(node_data, matched)
    log.info("")
    
    # Phase 9: Build taxonomy.json
    taxonomy = phase_9_build_taxonomy_json(matched)
    log.info("")
    
    # Phase 10: Build silhouette mapping
    silhouette_mapping = phase_10_build_silhouette_mapping(matched)
    log.info("")
    
    # Save outputs
    log.info("=" * 70)
    log.info("SAVING OUTPUTS")
    log.info("=" * 70)
    
    output_files = {
        OUTPUT_DIR / "hypothesis.json": hypothesis,
        OUTPUT_DIR / "taxonomy.json": taxonomy,
        OUTPUT_DIR / "silhouette-mapping.json": silhouette_mapping
    }
    
    for path, data in output_files.items():
        save_json(path, data)
    
    log.info("")
    
    # Final report
    log.info("=" * 70)
    log.info("FINAL REPORT")
    log.info("=" * 70)
    log.info(f"✓ Dataset complete: {len(matched)} species")
    log.info(f"✗ Excluded: {len(unmatched)} species")
    log.info(f"✓ Final tree: {len(pruned_tree.get_terminals())} terminals")
    log.info(f"✓ Internal nodes: {analysis['total_internal']}")
    log.info(f"✓ Unary nodes suppressed: {suppressed}")
    
    # Branching report
    if analysis['multifurcations'] == 0:
        branch_report = "Strictly bifurcating"
    else:
        branch_report = f"{analysis['multifurcations']} multifurcations"
    log.info(f"✓ Branching: {branch_report}")
    
    log.info(f"✓ Silhouettes: {len(silhouette_mapping['mappings'])} mapped images")
    log.info(f"\n✓ Output files:")
    for path in output_files:
        rel_path = path.relative_to(DATA_DIR.parent)
        log.info(f"  - {rel_path}")
    log.info("=" * 70)
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
