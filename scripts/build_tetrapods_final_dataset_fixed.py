#!/usr/bin/env python3
"""
Final Tetrapods Dataset Pipeline - Fixed version
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

sys.path.insert(0, str(Path(__file__).parent))
from tetrapods_tree_pruner import (
    prune_tree_to_selection,
    suppress_unary_nodes,
    analyze_branching_structure,
    assign_deterministic_ids,
)

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
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        log.error(f"Invalid JSON in {path}: {e}")
        raise

def save_json(path, data, indent=2):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)
        f.write("\n")
    log.info(f"Saved {path}")

def phase_9_build_taxonomy_json(matched_species):
    """Build taxonomy.json from GBIF records."""
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
            "scientificName": species["scientific_name"],
            "commonName": species.get("common_name"),
            "rank": gbif_match.get("rank", "SPECIES").lower(),
            "parent": None,
            "source": "GBIF",
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

def phase_10_build_silhouette_mapping(matched_species):
    """Build silhouette-mapping.json from PhyloPic inventory."""
    log.info("=" * 70)
    log.info("PHASE 10: Build silhouette-mapping.json")
    log.info("=" * 70)
    
    phylopic_data = load_json(DATA_DIR / "phylopic_inventory.json")
    phylopic_by_id = {}
    
    # Handle different possible structures
    for sp in phylopic_data.get("species", []):
        phylopic_by_id[sp["species_id"]] = sp
    
    mappings = {}
    mapped_count = 0
    unmapped_count = 0
    
    for species in matched_species:
        species_id = species["species_id"]
        tax_id = f"tax_{species_id}"
        phylopic_record = phylopic_by_id.get(species_id)
        
        if not phylopic_record:
            unmapped_count += 1
            log.debug(f"  No PhyloPic record for {species_id}")
            continue
        
        chosen_uuid = phylopic_record.get("chosen_image_uuid") or phylopic_record.get("image_uuid")
        
        if not chosen_uuid:
            unmapped_count += 1
            log.debug(f"  No image UUID for {species_id}")
            continue
        
        mappings[tax_id] = {
            "imageUuid": chosen_uuid,
            "license": phylopic_record.get("chosen_license", phylopic_record.get("license", "unknown")),
            "contributor": phylopic_record.get("chosen_contributor", phylopic_record.get("contributor", "unknown")),
            "source": "PhyloPic",
            "sourceUrl": f"https://www.phylopic.org/images/{chosen_uuid}"
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
    log.info(f"Building Tetrapods dataset at {datetime.now().isoformat()}\n")
    
    # Load pre-existing results from previous run
    DATA_DIR_BUILD = DATA_DIR / "build" / "final"
    hypothesis = load_json(DATA_DIR_BUILD / "hypothesis.json")
    
    # Reconstruct matched species list
    roster = load_json(DATA_DIR / "roster.json")
    timetree_data = load_json(DATA_DIR / "timetree_check.json")
    results_by_id = {r["species_id"]: r for r in timetree_data["results"]}
    
    matched = []
    for species in roster["species"]:
        species_id = species["id"]
        tt_record = results_by_id.get(species_id)
        if tt_record and tt_record.get("matched"):
            matched.append({
                "species_id": species_id,
                "scientific_name": species["scientific_name"],
                "common_name": species.get("common_name"),
                "group": species.get("group"),
            })
    
    log.info(f"Matched species: {len(matched)}\n")
    
    # Rebuild taxonomy and silhouette mappings
    taxonomy = phase_9_build_taxonomy_json(matched)
    log.info("")
    
    silhouette_mapping = phase_10_build_silhouette_mapping(matched)
    log.info("")
    
    # Save
    log.info("=" * 70)
    log.info("SAVING OUTPUTS")
    log.info("=" * 70)
    
    save_json(DATA_DIR_BUILD / "taxonomy.json", taxonomy)
    save_json(DATA_DIR_BUILD / "silhouette-mapping.json", silhouette_mapping)
    
    log.info("\n" + "=" * 70)
    log.info("COMPLETE")
    log.info("=" * 70)
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
