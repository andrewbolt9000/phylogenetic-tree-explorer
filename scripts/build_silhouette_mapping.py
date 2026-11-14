#!/usr/bin/env python3
"""
Build final silhouette-mapping.json for Tetrapods dataset.
Selects qualified images based on specificity and licensing.
"""

import json
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "tetrapods"
OUTPUT_DIR = DATA_DIR / "build" / "final"

def get_cc_license_tier(license_url):
    """Return tier for licensing (0=most permissive, higher=more restricted)."""
    url = (license_url or "").lower()
    if "zero" in url or "cc0" in url or "publicdomain" in url:
        return 0  # CC0 - public domain, most permissive
    if "by/3" in url or "by/4" in url:
        return 1  # CC-BY
    if "by-sa/3" in url or "by-sa/4" in url:
        return 2  # CC-BY-SA
    if "by-nc" in url:
        return 3  # CC-BY-NC
    if "by-nc-sa" in url:
        return 4  # CC-BY-NC-SA
    return 99  # Unknown/proprietary

def select_qualified_image(species_record):
    """
    Select the best qualified image for a species.
    Priority: species-specific > general > any
    Then: best license (CC0 > CC-BY > others)
    """
    images = species_record.get("images", [])
    
    if not images:
        return None
    
    # Filter for downloaded images
    downloaded = [img for img in images if img.get("download_status") == "downloaded"]
    
    if not downloaded:
        return None
    
    # Prefer species-specific
    specific = [img for img in downloaded if img.get("specific_taxon") == species_record.get("scientific_name")]
    
    candidates = specific if specific else downloaded
    
    # Sort by license tier (prefer permissive)
    candidates.sort(key=lambda img: get_cc_license_tier(img.get("license_url")))
    
    return candidates[0]

def main():
    print("Building silhouette-mapping.json for Tetrapods...")
    
    # Load inventory
    phylopic_data = json.load(open(DATA_DIR / "phylopic_inventory.json"))
    
    mappings = {}
    stats = {
        "total_species": 0,
        "mapped": 0,
        "by_license": {}
    }
    
    for sp in phylopic_data.get("species", []):
        species_id = sp["species_id"]
        tax_id = f"tax_{species_id}"
        
        stats["total_species"] += 1
        
        # Select qualified image
        selected = select_qualified_image(sp)
        
        if not selected:
            print(f"  ✗ {species_id}: No downloaded images available")
            continue
        
        license_url = selected.get("license_url", "unknown")
        license_clean = license_url.split("/")[-1] if license_url else "unknown"
        
        stats["by_license"][license_clean] = stats["by_license"].get(license_clean, 0) + 1
        stats["mapped"] += 1
        
        mappings[tax_id] = {
            "imageUuid": selected["image_uuid"],
            "license": license_url,
            "contributor": selected.get("attribution", "unknown"),
            "source": "PhyloPic",
            "sourceUrl": f"https://www.phylopic.org/images/{selected['image_uuid']}"
        }
    
    result = {
        "source": "PhyloPic",
        "generated": datetime.now().isoformat(),
        "stats": stats,
        "mappings": mappings
    }
    
    # Save
    output_path = OUTPUT_DIR / "silhouette-mapping.json"
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        f.write("\n")
    
    print(f"\n✓ Saved {output_path}")
    print(f"✓ Mapped {stats['mapped']} of {stats['total_species']} species")
    print(f"\nLicense distribution:")
    for lic, count in sorted(stats["by_license"].items()):
        print(f"  - {lic}: {count}")

if __name__ == "__main__":
    main()
