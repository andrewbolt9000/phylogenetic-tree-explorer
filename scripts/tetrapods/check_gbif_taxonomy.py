"""Check the 80-species tetrapod roster against the GBIF taxonomy."""

import json
import time
import urllib.request
import urllib.parse
import os
from collections import Counter

INPUT = "data/tetrapods/roster.json"
OUTPUT = "data/tetrapods/taxonomy_check_gbif.json"
USER_AGENT = "PhyloExplorer-TetrapodDataset/1.0"


def get_json(url):
    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def gbif_match(name):
    query = urllib.parse.urlencode({"name": name, "strict": "true"})
    url = f"https://api.gbif.org/v1/species/match?{query}"

    for attempt in range(3):
        try:
            return get_json(url)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


with open(INPUT) as file:
    roster = json.load(file)

results = []

for index, species in enumerate(roster["species"], 1):
    name = species["scientific_name"]
    print(f"[{index}/{len(roster['species'])}] {name}", flush=True)

    record = {
        "species_id": species["id"],
        "common_name": species["common_name"],
        "submitted_name": name,
        "group": species["group"],
    }

    try:
        match = gbif_match(name)

        fields = [
            "usageKey", "acceptedUsageKey", "scientificName",
            "canonicalName", "rank", "status", "matchType",
            "confidence", "taxonomicStatus", "kingdom", "phylum",
            "class", "order", "family", "genus", "species",
            "speciesKey", "accordingTo",
        ]
        record["gbif_match"] = {
            key: match.get(key) for key in fields
        }

        accepted_key = match.get("acceptedUsageKey")
        if accepted_key:
            accepted = get_json(
                f"https://api.gbif.org/v1/species/{accepted_key}"
            )
            accepted_fields = [
                "key", "scientificName", "canonicalName", "rank",
                "taxonomicStatus", "kingdom", "phylum", "class",
                "order", "family", "genus", "species", "authorship",
            ]
            record["accepted_taxon"] = {
                key: accepted.get(key) for key in accepted_fields
            }

        if (
            match.get("matchType") == "EXACT"
            and match.get("rank") == "SPECIES"
        ):
            record["audit_status"] = "exact_species_match"
        elif match.get("usageKey"):
            record["audit_status"] = "matched_review_required"
        else:
            record["audit_status"] = "no_match"

        print(
            " ", record["audit_status"],
            "|", match.get("scientificName"),
            "|", match.get("status"),
        )

    except Exception as error:
        record["audit_status"] = "request_error"
        record["error"] = str(error)
        print("  ERROR:", error)

    results.append(record)
    time.sleep(0.15)

counts = Counter(r["audit_status"] for r in results)

output = {
    "dataset": roster["dataset"],
    "roster_version": roster["version"],
    "source": "GBIF Species API",
    "source_url": "https://api.gbif.org/v1/species/match",
    "date": "2026-11-13",
    "method": "Strict scientific-name matching against GBIF taxonomic backbone",
    "summary": dict(counts),
    "results": results,
}

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
with open(OUTPUT, "w") as file:
    json.dump(output, file, indent=2, ensure_ascii=False)

print("\nSaved:", OUTPUT)
for status, count in counts.items():
    print(status + ":", count)

print("\nNeeds review:")
for record in results:
    if record["audit_status"] != "exact_species_match":
        print(
            record["submitted_name"],
            "|", record["audit_status"],
            "|", record.get("gbif_match", {}).get("scientificName"),
        )
