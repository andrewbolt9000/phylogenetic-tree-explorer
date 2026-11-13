#!/usr/bin/env python3
"""
Validate PhyloPic resolution output CSV.

Performs comprehensive checks on the generated output to ensure:
- All 600 animals are present
- No duplicate row IDs
- Manual UUIDs are preserved correctly
- Effective UUID logic works
- All required fields are present
- Status values are consistent
"""

import csv
import sys
from pathlib import Path
from collections import Counter

def validate_output(csv_path: Path) -> bool:
    """Validate PhyloPic output CSV."""
    
    print(f"Validating {csv_path}...")
    print()
    
    if not csv_path.exists():
        print(f"ERROR: Output file not found: {csv_path}")
        return False
    
    # Read the CSV
    rows = []
    try:
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as e:
        print(f"ERROR: Failed to read CSV: {e}")
        return False
    
    print(f"✓ CSV loaded successfully")
    print()
    
    # Check count
    if len(rows) != 600:
        print(f"✗ FAIL: Expected 600 rows, got {len(rows)}")
        return False
    print(f"✓ Total rows: {len(rows)}")
    
    # Check row IDs
    row_ids = [r.get('_row_id', '') for r in rows]
    if len(row_ids) != len(set(row_ids)):
        duplicates = [rid for rid, count in Counter(row_ids).items() if count > 1]
        print(f"✗ FAIL: Duplicate row IDs: {duplicates}")
        return False
    print(f"✓ No duplicate row IDs")
    
    # Check all expected row IDs present
    expected_ids = {f"row_{i}" for i in range(600)}
    actual_ids = set(row_ids)
    missing = expected_ids - actual_ids
    extra = actual_ids - expected_ids
    
    if missing:
        print(f"✗ FAIL: Missing row IDs: {sorted(missing)[:10]}... ({len(missing)} total)")
        return False
    if extra:
        print(f"✗ FAIL: Unexpected row IDs: {sorted(extra)[:10]}... ({len(extra)} total)")
        return False
    print(f"✓ All row IDs accounted for (row_0 through row_599)")
    
    # Check required fields
    if not rows:
        print("✗ FAIL: No rows to validate")
        return False
    
    required_fields = [
        '_row_id', 'collection', 'common_name', 'ott_id',
        'phylopic_node_uuid', 'phylopic_image_uuid', 'manual_phylopic_image_uuid',
        'effective_phylopic_image_uuid', 'phylopic_match_status', 'phylopic_match_type'
    ]
    
    missing_fields = []
    for field in required_fields:
        if field not in rows[0]:
            missing_fields.append(field)
    
    if missing_fields:
        print(f"✗ FAIL: Missing fields: {missing_fields}")
        return False
    print(f"✓ All required fields present")
    
    # Analyze effective UUID logic
    manual_preserved = 0
    auto_used = 0
    empty_effective = 0
    
    for row in rows:
        manual = row.get('manual_phylopic_image_uuid', '').strip()
        auto = row.get('phylopic_image_uuid', '').strip()
        effective = row.get('effective_phylopic_image_uuid', '').strip()
        
        if manual:
            if effective == manual:
                manual_preserved += 1
            else:
                print(f"✗ FAIL: Row {row['_row_id']}: manual UUID not used in effective")
                return False
        elif auto:
            if effective == auto:
                auto_used += 1
            elif not effective:
                empty_effective += 1
        else:
            empty_effective += 1
    
    print(f"✓ Manual UUIDs preserved: {manual_preserved}")
    print(f"✓ Automatic UUIDs used (no manual): {auto_used}")
    print(f"✓ Empty effective UUIDs: {empty_effective}")
    
    # Check status distribution
    statuses = [r.get('phylopic_match_status', '') for r in rows]
    status_counts = Counter(statuses)
    
    print()
    print("Image resolution status distribution:")
    for status, count in sorted(status_counts.items()):
        pct = (count / len(rows) * 100)
        print(f"  {status:20} {count:4}  ({pct:.1f}%)")
    
    # Check match types for non-empty results
    match_types = Counter()
    for row in rows:
        if row.get('phylopic_match_status') == 'image_match':
            match_type = row.get('phylopic_match_type', 'unknown')
            match_types[match_type] += 1
    
    if match_types:
        print()
        print("Match types (for image_match status):")
        for mtype, count in sorted(match_types.items()):
            print(f"  {mtype:20} {count:4}")
    
    # Verify consistency: image_match should have image_uuid
    image_match_without_uuid = sum(
        1 for r in rows
        if r.get('phylopic_match_status') == 'image_match'
        and not r.get('phylopic_image_uuid', '').strip()
    )
    
    if image_match_without_uuid > 0:
        print(f"✗ FAIL: {image_match_without_uuid} rows marked image_match but have no image_uuid")
        return False
    print(f"✓ All image_match rows have image UUIDs")
    
    # Check that image_uuid is populated for image_match
    image_matches = sum(1 for r in rows if r.get('phylopic_match_status') == 'image_match')
    if image_matches > 0:
        print(f"✓ Image matches found: {image_matches}")
    
    print()
    print("=" * 70)
    print("All validation checks passed! ✓")
    print("=" * 70)
    
    return True


if __name__ == '__main__':
    output_path = Path("data/phyloexplorer_600_animal_master_list_phylopic.csv")
    
    if len(sys.argv) > 1:
        output_path = Path(sys.argv[1])
    
    success = validate_output(output_path)
    sys.exit(0 if success else 1)
