"""Collect PhyloPic clade images for the independent tetrapod roster.

Uses node UUIDs already recorded in phylopic_inventory.json.
Downloads SVG vectors and preserves image/taxonomy/attribution metadata.
"""

import json
import time
import urllib.request
import urllib.parse
from pathlib import Path

INVENTORY = Path("data/tetrapods/phylopic_inventory.json")
OUTPUT = INVENTORY
API = "https://api.phylopic.org"
BUILD = 562
HEADERS = {"Accept": "application/vnd.phylopic.v2+json"}

def get_json(url):
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def get_bytes(url):
    request = urllib.request.Request(url)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read(), response.headers.get("Content-Type", "")

def relation(links, key):
    value = (links or {}).get(key) or {}
    return value if isinstance(value, dict) else {}

with INVENTORY.open() as file:
    inventory = json.load(file)

total_images = 0
downloaded = 0
errors = 0

for index, species in enumerate(inventory["species"], 1):
    node_uuid = species.get("node_uuid")
    if not node_uuid:
        print(f"[{index}/80] {species['scientific_name']}: unresolved node")
        continue

    print(f"[{index}/80] {species['scientific_name']}")

    try:
        node_url = f"{API}/nodes/{node_uuid}?build={BUILD}"
        node = get_json(node_url)
        clade_link = relation(node.get("_links"), "cladeImages")
        href = clade_link.get("href")

        if not href:
            species["status"] = "no_clade_image_collection"
            species["images"] = []
            species["image_count"] = 0
            continue

        url = urllib.parse.urljoin(API, href)
        separator = "&" if "?" in url else "?"
        url += separator + "embed_items=true&page=0"

        images = []
        seen = set()

        while url:
            page = get_json(url)

            for item in (page.get("_embedded") or {}).get("items", []):
                uid = item.get("uuid")
                if not uid or uid in seen:
                    continue
                seen.add(uid)

                links = item.get("_links") or {}
                specific = relation(links, "specificNode")
                general = relation(links, "generalNode")
                contributor = relation(links, "contributor")
                license_info = relation(links, "license")

                vector_url = (
                    f"https://images.phylopic.org/images/{uid}/vector.svg"
                )
                local_path = (
                    Path("data/tetrapods/phylopic_images")
                    / species["species_id"]
                    / f"{uid}.svg"
                )
                local_path.parent.mkdir(parents=True, exist_ok=True)

                record = {
                    "image_uuid": uid,
                    "specific_taxon": specific.get("title"),
                    "specific_node_href": specific.get("href"),
                    "general_taxon": general.get("title"),
                    "general_node_href": general.get("href"),
                    "attribution": contributor.get("title"),
                    "license_url": license_info.get("href"),
                    "vector_url": vector_url,
                    "local_file": str(local_path),
                }

                try:
                    content, content_type = get_bytes(vector_url)
                    local_path.write_bytes(content)
                    record.update({
                        "download_status": "downloaded",
                        "file_size_bytes": len(content),
                        "content_type": content_type,
                    })
                    downloaded += 1
                except Exception as error:
                    record.update({
                        "download_status": "download_error",
                        "download_error": str(error),
                    })
                    errors += 1

                images.append(record)
                total_images += 1

            next_link = relation(page.get("_links"), "next")
            url = (
                urllib.parse.urljoin(API, next_link["href"])
                if next_link.get("href") else None
            )

        species["images"] = images
        species["image_count"] = len(images)
        species["status"] = (
            "images_collected" if images else "no_images_found"
        )
        print(f"  Images: {len(images)}")

    except Exception as error:
        species["status"] = "collection_error"
        species["collection_error"] = str(error)
        errors += 1
        print("  ERROR:", error)

    with OUTPUT.open("w") as file:
        json.dump(inventory, file, indent=2, ensure_ascii=False)

    time.sleep(0.15)

inventory["summary"] = {
    "species": len(inventory["species"]),
    "resolved_nodes": sum(bool(s.get("node_uuid")) for s in inventory["species"]),
    "unresolved_nodes": sum(not bool(s.get("node_uuid")) for s in inventory["species"]),
    "images_found": total_images,
    "vectors_downloaded": downloaded,
    "vector_download_errors": errors,
    "species_with_images": sum(bool(s.get("images")) for s in inventory["species"]),
    "species_without_images": sum(not bool(s.get("images")) for s in inventory["species"]),
}

with OUTPUT.open("w") as file:
    json.dump(inventory, file, indent=2, ensure_ascii=False)

print("\nSaved:", OUTPUT)
print(json.dumps(inventory["summary"], indent=2))
