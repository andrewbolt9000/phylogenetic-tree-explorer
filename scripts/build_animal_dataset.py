import csv
import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data/phyloexplorer_600_animal_master_list_phylopic.csv"
TREE_PATH = Path("/tmp/phyloexplorer_induced_tree.json")
CACHE = ROOT / "scripts/.ott_lineage_cache"
OUT = ROOT / "data/animals"

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8")

# --- Parse Newick while preserving every node and branch ---

class NewickParser:
    def __init__(self, text):
        self.text = text
        self.i = 0

    def skip_space(self):
        while self.i < len(self.text) and self.text[self.i].isspace():
            self.i += 1

    def label(self):
        self.skip_space()
        if self.i >= len(self.text) or self.text[self.i] in "(),:;":
            return ""

        if self.text[self.i] == "'":
            self.i += 1
            chars = []
            while self.i < len(self.text):
                c = self.text[self.i]
                self.i += 1
                if c == "'":
                    if self.i < len(self.text) and self.text[self.i] == "'":
                        chars.append("'")
                        self.i += 1
                    else:
                        break
                else:
                    chars.append(c)
            return "".join(chars)

        start = self.i
        while self.i < len(self.text) and self.text[self.i] not in "(),:;":
            self.i += 1
        return self.text[start:self.i].strip()

    def skip_branch_length(self):
        self.skip_space()
        if self.i < len(self.text) and self.text[self.i] == ":":
            self.i += 1
            while self.i < len(self.text) and self.text[self.i] not in ",);":
                self.i += 1

    def subtree(self):
        self.skip_space()
        children = []

        if self.i < len(self.text) and self.text[self.i] == "(":
            self.i += 1
            while True:
                children.append(self.subtree())
                self.skip_space()
                if self.i >= len(self.text):
                    raise ValueError("Unexpected end of Newick")
                c = self.text[self.i]
                self.i += 1
                if c == ")":
                    break
                if c != ",":
                    raise ValueError(f"Unexpected Newick character: {c}")

        node = {"label": self.label(), "children": children}
        self.skip_branch_length()
        return node

    def parse(self):
        root = self.subtree()
        self.skip_space()
        if self.i < len(self.text) and self.text[self.i] == ";":
            self.i += 1
        if self.text[self.i:].strip():
            raise ValueError("Unexpected content after Newick tree")
        return root

# --- Read candidate roster and retain only taxa represented in the tree ---

with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))

tree_data = read_json(TREE_PATH)
root = NewickParser(tree_data["newick"]).parse()

nodes_in_order = []

def flatten(node, parent=None):
    nodes_in_order.append((node, parent))
    for child in node["children"]:
        flatten(child, node)

flatten(root)

label_to_node = {}
for node, parent in nodes_in_order:
    match = re.search(r"(?:_|\s)ott(\d+)$", node["label"])
    if match:
        ott_id = match.group(1)
        if ott_id in label_to_node:
            raise ValueError(f"Duplicate OTT ID in Newick: {ott_id}")
        label_to_node[ott_id] = node

selected = {}
for row in rows:
    ott = row["ott_id"].strip()
    image = row["effective_phylopic_image_uuid"].strip()
    if ott and image and ott in label_to_node:
        if ott in selected:
            raise ValueError(f"Duplicate roster OTT ID: {ott}")
        selected[ott] = row

print(f"CSV candidates: {len(rows)}")
print(f"Selected taxa represented in tree: {len(selected)}")

if len(selected) != 593:
    raise ValueError(
        f"Expected 593 represented taxa, found {len(selected)}. "
        "Check the tree and roster before generating."
    )

# --- Build taxonomy using OTL lineage only ---

taxonomy = {}
target_ids = set(selected)

def add_taxon(item, common_name=None):
    ott = str(item["ott_id"])
    tax_id = f"tax_ott{ott}"
    lineage_parent = None

    record = {
        "id": tax_id,
        "scientificName": item["name"],
        "rank": item.get("rank") or "no rank",
        "parent": None,
        "extinct": None,
        "synonyms": item.get("synonyms", []),
        "source": "Open Tree of Life Taxonomy",
        "sourceId": f"ott{ott}",
    }

    flags = item.get("flags") or []
    if isinstance(flags, str):
        flags = [flags]
    if any("extinct" in str(flag).lower() for flag in flags):
        record["extinct"] = True

    if common_name:
        record["commonName"] = common_name

    if tax_id in taxonomy:
        old = taxonomy[tax_id]
        for field in ("scientificName", "rank"):
            if old[field] != record[field]:
                raise ValueError(f"Conflicting {field} for OTT {ott}")
        if common_name and old.get("commonName") not in (None, common_name):
            raise ValueError(f"Conflicting common names for OTT {ott}")
        if common_name:
            old["commonName"] = common_name
        return tax_id

    taxonomy[tax_id] = record
    return tax_id

for ott, row in selected.items():
    info = read_json(CACHE / f"ott{ott}.json")
    lineage = info.get("lineage", [])

    target_id = add_taxon(info, row["common_name"].strip() or None)
    if lineage:
        taxonomy[target_id]["parent"] = f"tax_ott{lineage[0]['ott_id']}"

    for index, ancestor in enumerate(lineage):
        ancestor_id = add_taxon(ancestor)
        parent_id = (
            f"tax_ott{lineage[index + 1]['ott_id']}"
            if index + 1 < len(lineage) else None
        )
        existing_parent = taxonomy[ancestor_id]["parent"]
        if existing_parent is not None and existing_parent != parent_id:
            raise ValueError(f"Conflicting lineage parent for {ancestor_id}")
        taxonomy[ancestor_id]["parent"] = parent_id

# Ensure every parent reference exists.
for taxon in taxonomy.values():
    parent = taxon["parent"]
    if parent is not None and parent not in taxonomy:
        raise ValueError(f"Missing taxonomy parent: {parent}")

# --- Convert Newick nodes into hypothesis nodes ---

hypothesis_nodes = []
internal_counter = 0
mapped_ott = set()

def convert(node, parent_id=None):
    global internal_counter

    label_match = re.search(r"(?:_|\s)ott(\d+)$", node["label"])
    ott = label_match.group(1) if label_match else None
    is_empty_mrca = (
        len(node["children"]) == 0
        and node["label"].startswith("mrca")
    )
    is_terminal = len(node["children"]) == 0 and not is_empty_mrca

    if is_terminal:
        if ott not in selected:
            raise ValueError(
                f"Unexpected terminal without selected roster entry: {node['label']}"
            )
        node_id = f"tax_ott{ott}"
    else:
        node_id = f"ancestor_otl_{internal_counter:06d}"
        internal_counter += 1

    taxon_id = f"tax_ott{ott}" if ott in selected else None
    if taxon_id:
        if ott in mapped_ott:
            raise ValueError(f"Selected taxon mapped more than once: {ott}")
        mapped_ott.add(ott)

    if taxon_id:
        print(
            f"MAPPED {ott}: {node['label']!r} "
            f"type={'terminal' if is_terminal else 'internal'} "
            f"children={len(node['children'])}"
        )


    record = {
        "id": node_id,
        "type": "terminal" if is_terminal else "internal",
        "parentId": parent_id,
        "children": [],
    }
    if taxon_id:
        record["taxonId"] = taxon_id

    hypothesis_nodes.append(record)

    for child in node["children"]:
        child_id = convert(child, node_id)
        record["children"].append(child_id)

    return node_id

root_id = convert(root)

if mapped_ott != set(selected):
    missing = sorted(set(selected) - mapped_ott)
    raise ValueError(f"Selected taxa not mapped to tree nodes: {missing[:20]}")

terminal_count = sum(n["type"] == "terminal" for n in hypothesis_nodes)
internal_count = sum(n["type"] == "internal" for n in hypothesis_nodes)
internal_taxa = sum(
    n["type"] == "internal" and "taxonId" in n
    for n in hypothesis_nodes
)

if terminal_count != 591 or internal_taxa != 2:
    raise ValueError(
        f"Unexpected topology mapping: {terminal_count} terminals, "
        f"{internal_taxa} selected internal taxa"
    )

# --- PhyloPic mapping ---

silhouettes = {}
for ott, row in selected.items():
    tax_id = f"tax_ott{ott}"
    silhouettes[tax_id] = {
        "imageUuid": row["effective_phylopic_image_uuid"].strip(),
        "license": row["phylopic_license"].strip(),
        "contributor": row["phylopic_contributor"].strip(),
        "source": "PhyloPic",
        "sourceUrl": (
            "https://www.phylopic.org/images/"
            + row["effective_phylopic_image_uuid"].strip()
        ),
    }

# --- Write dataset ---

OUT.mkdir(parents=True, exist_ok=True)

write_json(OUT / "taxonomy.json", {
    "taxonomy": list(taxonomy.values()),
    "metadata": {
        "source": "Open Tree of Life Taxonomy",
        "sourceUrl": "https://tree.opentreeoflife.org/",
        "version": "OTT 3.7 (API response source recorded per taxon)",
        "accessDate": "2026-11-13",
        "notes": (
            "Taxonomic parentage follows OTL lineage responses. "
            "Unknown extinction status is null; it is not assumed extant."
        ),
    },
})

write_json(OUT / "hypothesis.json", {
    "hypothesisId": "phylo_animals_otl_1",
    "hypothesisName": "Animal phylogeny — Open Tree of Life induced subtree",
    "source": "Open Tree of Life synthetic tree, induced subtree",
    "rootNodeId": root_id,
    "terminalIdPrefix": "tax_",
    "internalIdPrefix": "ancestor_otl_",
    "sourceMetadata": {
        "method": "Open Tree of Life induced_subtree API",
        "supportingStudies": tree_data.get("supporting_studies", []),
        "note": (
            "Original OTL topology preserved. No divergence dates or "
            "additional evolutionary branches have been inferred."
        ),
    },
    "nodes": hypothesis_nodes,
})

write_json(OUT / "silhouette-mapping.json", {
    "source": "PhyloPic",
    "mappings": silhouettes,
})

(OUT / "README.md").write_text(
    f"""# Animal dataset

Generated from the curated 600-animal roster, Open Tree of Life taxonomy
lineage responses, the OTL induced subtree, and PhyloPic image UUID mappings.

- Selected taxa represented in the tree: {len(selected)}
- Terminal nodes: {terminal_count}
- Selected taxa represented on internal nodes: {internal_taxa}
- Total tree nodes: {len(hypothesis_nodes)}
- Taxonomy records, including ancestors: {len(taxonomy)}
- PhyloPic mappings: {len(silhouettes)}
- Supporting studies reported by OTL: {len(tree_data.get('supporting_studies', []))}

Taxonomy parentage comes from OTL lineage data. Phylogenetic parentage comes
from the OTL induced subtree. These are separate structures.

Unknown extinction status is represented as `null`. No divergence dates
have been inferred. Silhouette image files have not been downloaded.
""",
    encoding="utf-8",
)

print("\nGenerated data/animals:")
print("Taxonomy records:", len(taxonomy))
print("Tree nodes:", len(hypothesis_nodes))
print("Terminals:", terminal_count)
print("Selected internal taxa:", internal_taxa)
print("Silhouette mappings:", len(silhouettes))
