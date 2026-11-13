"""Check the independent tetrapod roster against the raw TimeTree Newick file."""

import json
import re
from pathlib import Path
from collections import Counter

ROSTER_PATH = Path("data/tetrapods/roster.json")
TREE_PATH = Path("data/time_tree_raw_data/TT6_Tetrapods.nwk")
OUTPUT_PATH = Path("data/tetrapods/timetree_check.json")


def extract_tip_names(newick):
    """Extract terminal labels immediately preceding branch lengths."""
    pattern = re.compile(r"""(?:'([^']+)'|([^(),:]+))\s*:""")
    names = []

    for match in pattern.finditer(newick):
        name = match.group(1) or match.group(2)
        names.append(name.strip())

    return set(names)


with ROSTER_PATH.open() as file:
    roster = json.load(file)

newick = TREE_PATH.read_text()
tree_tips = extract_tip_names(newick)

results = []

for species in roster["species"]:
    scientific_name = species["scientific_name"]
    tree_name = scientific_name.replace(" ", "_")
    matched = tree_name in tree_tips

    results.append({
        "species_id": species["id"],
        "common_name": species["common_name"],
        "scientific_name": scientific_name,
        "group": species["group"],
        "timetree_name": tree_name,
        "matched": matched,
        "status": "matched" if matched else "missing",
    })

counts = Counter(
    (record["group"], record["status"]) for record in results
)

summary = {
    "candidates": len(results),
    "matched": sum(record["matched"] for record in results),
    "missing": sum(not record["matched"] for record in results),
    "tree_terminal_labels": len(tree_tips),
    "by_group": {},
}

for group in ("mammals", "birds", "reptiles", "amphibians"):
    group_records = [r for r in results if r["group"] == group]
    summary["by_group"][group] = {
        "candidates": len(group_records),
        "matched": sum(r["matched"] for r in group_records),
        "missing": sum(not r["matched"] for r in group_records),
    }

output = {
    "dataset": roster["dataset"],
    "roster_version": roster["version"],
    "source_tree": str(TREE_PATH),
    "check_date": "2026-11-13",
    "method": "Exact scientific-name match after replacing spaces with underscores",
    "summary": summary,
    "results": results,
}

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False))

print("Saved:", OUTPUT_PATH)
print("Tree terminal labels:", len(tree_tips))
print("Candidates:", summary["candidates"])
print("Matched:", summary["matched"])
print("Missing:", summary["missing"])

for record in results:
    if not record["matched"]:
        print("MISSING:", record["scientific_name"])
