import assert from "assert";
import { test } from "node:test";
import { readFileSync } from "fs";
import { resolve } from "path";

const DATA_DIR = resolve("./data/tetrapods");

function loadJSON(path) {
  return JSON.parse(readFileSync(resolve(DATA_DIR, path), "utf-8"));
}

test("Tetrapods Dataset Integration", async (t) => {
  // Test 1: Load files
  await t.test("Files exist and load without error", () => {
    const hypothesis = loadJSON("hypothesis.json");
    const taxonomy = loadJSON("taxonomy.json");
    const silhouettes = loadJSON("silhouette-mapping.json");
    
    assert.ok(hypothesis, "hypothesis.json loaded");
    assert.ok(taxonomy, "taxonomy.json loaded");
    assert.ok(silhouettes, "silhouette-mapping.json loaded");
  });
  
  // Test 2: Hypothesis structure
  await t.test("Hypothesis has valid structure", () => {
    const hyp = loadJSON("hypothesis.json");
    
    assert.strictEqual(hyp.hypothesisId, "phylo_tetrapods", "Correct hypothesis ID");
    assert.ok(hyp.rootNodeId, "Root node ID present");
    assert.ok(Array.isArray(hyp.nodes), "Nodes is an array");
    assert.ok(hyp.nodes.length > 0, "Has nodes");
  });
  
  // Test 3: Node counts
  await t.test("Node counts are reasonable", () => {
    const hyp = loadJSON("hypothesis.json");
    
    const terminals = hyp.nodes.filter(n => n.type === "terminal");
    const internals = hyp.nodes.filter(n => n.type === "internal");
    
    assert.strictEqual(terminals.length, 57, "57 terminal nodes (complete-case set)");
    assert.ok(internals.length > 0, "Has internal nodes");
    assert.ok(internals.length < terminals.length * 2, "Internal nodes not unreasonable");
  });
  
  // Test 4: Taxonomy structure
  await t.test("Taxonomy has all terminals", () => {
    const hyp = loadJSON("hypothesis.json");
    const tax = loadJSON("taxonomy.json");
    
    const terminals = hyp.nodes.filter(n => n.type === "terminal");
    const taxonIds = new Set(tax.taxonomy.map(t => t.id));
    
    for (const term of terminals) {
      assert.ok(taxonIds.has(term.id), `Terminal ${term.id} in taxonomy`);
    }
  });
  
  // Test 5: Silhouette mapping
  await t.test("Silhouette mapping has entries", () => {
    const silhouettes = loadJSON("silhouette-mapping.json");
    
    assert.ok(silhouettes.mappings, "Has mappings");
    const count = Object.keys(silhouettes.mappings).length;
    assert.ok(count > 50, `Has ${count} image mappings (>50)`);
  });
  
  // Test 6: Root node is valid
  await t.test("Root node is properly structured", () => {
    const hyp = loadJSON("hypothesis.json");
    
    const root = hyp.nodes.find(n => n.id === hyp.rootNodeId);
    assert.ok(root, "Root node exists");
    assert.strictEqual(root.type, "internal", "Root is internal node");
    assert.strictEqual(root.parentId, null, "Root has no parent");
    assert.ok(Array.isArray(root.children), "Root has children array");
    assert.ok(root.children.length > 0, "Root has children");
  });
  
  // Test 7: Tree structure integrity
  await t.test("Tree has valid parent-child relationships", () => {
    const hyp = loadJSON("hypothesis.json");
    
    const nodeById = new Map(hyp.nodes.map(n => [n.id, n]));
    let errors = 0;
    
    for (const node of hyp.nodes) {
      // Check parent
      if (node.parentId !== null) {
        if (!nodeById.has(node.parentId)) {
          errors++;
        }
      }
      
      // Check children
      for (const childId of node.children) {
        const child = nodeById.get(childId);
        if (!child || child.parentId !== node.id) {
          errors++;
        }
      }
    }
    
    assert.strictEqual(errors, 0, "No tree structure errors");
  });
  
  // Test 8: Dataset metadata
  await t.test("Metadata is present and valid", () => {
    const hyp = loadJSON("hypothesis.json");
    const tax = loadJSON("taxonomy.json");
    
    assert.ok(hyp.source, "Hypothesis has source");
    assert.ok(tax.metadata, "Taxonomy has metadata");
    assert.ok(tax.metadata.source, "Metadata has source");
    assert.ok(tax.metadata.license, "Metadata has license");
    assert.ok(tax.metadata.accessDate, "Metadata has access date");
  });
});
