import copy
import json
import shutil
from pathlib import Path
from datetime import date

from Bio import Phylo

ROOT = Path.cwd()
DATA = ROOT / "data" / "tetrapods"
SOURCE_TREE = ROOT / "data" / "time_tree_raw_data" / "TT6_Tetrapods.nwk"
OUTPUT = DATA / "build" / "preliminary_v1"


def load_json(path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main():
    roster = load_json(DATA / "roster.json")
    timetree = load_json(DATA / "timetree_check.json")
    inventory = load_json(DATA / "phylopic_inventory.json")

    tt_by_id = {r["species_id"]: r for r in timetree["results"]}
    pp_by_id = {r["species_id"]: r for r in inventory["species"]}

    original_tree = Phylo.read(str(SOURCE_TREE), "newick")
    original_terminals = original_tree.get_terminals()

    label_to_terminal = {}
    for terminal in original_terminals:
        if terminal.name in label_to_terminal:
            raise ValueError(f"Duplicate terminal label: {terminal.name}")
        label_to_terminal[terminal.name] = terminal

    included = []
    excluded = []

    for species in roster["species"]:
        sid = species["id"]
        tt_record = tt_by_id.get(sid, {})
        pp_record = pp_by_id.get(sid, {})

        expected_label = (
            tt_record.get("expected_tree_label")
            or species["scientific_name"].replace(" ", "_")
        )

        tree_match = (
            tt_record.get("matched", False)
            and expected_label in label_to_terminal
        )

        downloaded_images = [
            image for image in pp_record.get("images", [])
            if image.get("download_status") == "downloaded"
        ]

        if tree_match and downloaded_images:
            included.append({
                "species": species,
                "tree_label": expected_label,
                "images": downloaded_images,
            })
        else:
            reasons = []
            if not tree_match:
                reasons.append("no_exact_TimeTree_terminal")
            if not downloaded_images:
                reasons.append("no_downloaded_PhyloPic_images")

            excluded.append({
                "id": sid,
                "scientific_name": species["scientific_name"],
                "reasons": reasons,
            })

    if not included:
        raise RuntimeError("No species qualified for the preliminary build.")

    # Record original root-to-tip distances before pruning.
    retained_labels = {item["tree_label"] for item in included}
    original_distances = {
        label: original_tree.distance(
            original_tree.root, label_to_terminal[label]
        )
        for label in retained_labels
    }

    # Work on a copy; never modify the raw source tree.
    pruned_tree = copy.deepcopy(original_tree)

    for terminal in list(pruned_tree.get_terminals()):
        if terminal.name not in retained_labels:
            pruned_tree.prune(terminal)

    final_labels = {t.name for t in pruned_tree.get_terminals()}

    if final_labels != retained_labels:
        raise RuntimeError(
            "Pruned tree terminal set does not match the selected roster."
        )

    # Pruning should preserve root-to-tip distances.
    distance_errors = []
    for terminal in pruned_tree.get_terminals():
        before = original_distances[terminal.name]
        after = pruned_tree.distance(pruned_tree.root, terminal)
        if abs(before - after) > 1e-7:
            distance_errors.append((terminal.name, before, after))

    if distance_errors:
        raise RuntimeError(
            f"Root-to-tip distances changed during pruning: {distance_errors[:5]}"
        )

    # Write outputs to a new, versioned build directory.
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image_root = OUTPUT / "images"

    selected_species = []
    image_index = []

    for item in included:
        species = copy.deepcopy(item["species"])
        species["tree_label"] = item["tree_label"]
        species["dataset_status"] = "preliminary"
        species["image_qualification"] = "pending"
        species["image_count"] = len(item["images"])
        selected_species.append(species)

        for image in item["images"]:
            source = ROOT / image["local_file"]

            if not source.is_file():
                raise FileNotFoundError(
                    f"Expected downloaded image is missing: {source}"
                )

            destination_rel = (
                Path("images") / species["id"] /
                f'{image["image_uuid"]}.svg'
            )
            destination = OUTPUT / destination_rel
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)

            record = copy.deepcopy(image)
            record["species_id"] = species["id"]
            record["local_file"] = destination_rel.as_posix()
            record["qualification_status"] = "pending"
            image_index.append(record)

    build_roster = {
        "dataset": "Tetrapod Dataset",
        "version": "preliminary_v1",
        "status": "preliminary_image_qualification_pending",
        "created": date.today().isoformat(),
        "source_roster": "data/tetrapods/roster.json",
        "species_count": len(selected_species),
        "image_qualification_policy": (
            "Only exact species-level and verified subspecies-level "
            "PhyloPic assignments may be approved. This build has not "
            "yet completed that qualification audit."
        ),
        "species": selected_species,
    }

    save_json(OUTPUT / "roster.json", build_roster)
    save_json(OUTPUT / "images.json", {
        "dataset": "Tetrapod Dataset",
        "status": "image_qualification_pending",
        "image_count": len(image_index),
        "images": image_index,
    })

    tree_path = OUTPUT / "tree.nwk"
    Phylo.write(
        pruned_tree,
        str(tree_path),
        "newick",
        format_branch_length="%1.5f",
    )

    manifest = {
        "dataset": "Tetrapod Dataset",
        "build": "preliminary_v1",
        "created": date.today().isoformat(),
        "source_tree": "data/time_tree_raw_data/TT6_Tetrapods.nwk",
        "source_roster": "data/tetrapods/roster.json",
        "source_timetree_audit": "data/tetrapods/timetree_check.json",
        "source_phylopic_inventory": "data/tetrapods/phylopic_inventory.json",
        "species_included": len(selected_species),
        "species_excluded": len(excluded),
        "images_copied": len(image_index),
        "tree_terminals": len(final_labels),
        "root_to_tip_distances_preserved": True,
        "image_qualification": "pending",
        "excluded_species": excluded,
        "outputs": [
            "roster.json",
            "tree.nwk",
            "images.json",
            "images/",
        ],
    }
    save_json(OUTPUT / "manifest.json", manifest)

    print("PRELIMINARY DATASET BUILT")
    print("=" * 55)
    print("Output:", OUTPUT.relative_to(ROOT))
    print("Species included:", len(selected_species))
    print("Species excluded:", len(excluded))
    print("Images copied:", len(image_index))
    print("Tree terminals:", len(final_labels))
    print("Root-to-tip distances preserved: YES")
    print("Image qualification: PENDING")
    print("\nExcluded species:")
    for record in excluded:
        print(" ", record["scientific_name"], "-", ", ".join(record["reasons"]))


if __name__ == "__main__":
    main()
