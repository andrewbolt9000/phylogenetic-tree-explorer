import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

const HYPOTHESIS_PATH = './data/tetrapods/hypothesis.json';

const hypothesis = JSON.parse(fs.readFileSync(HYPOTHESIS_PATH, 'utf8'));

test('Tetrapods Node Ages - TimeTree 6', async (t) => {
  const TIMETREE_ROOT_AGE = 352.08192;
  const nodes_by_id = Object.fromEntries(hypothesis.nodes.map(n => [n.id, n]));

  await t.test('Root node has correct age', () => {
    const root = nodes_by_id[hypothesis.rootNodeId];
    assert(root, 'Root node exists');
    assert.strictEqual(root.age_ma, TIMETREE_ROOT_AGE, 
      `Root age should be ${TIMETREE_ROOT_AGE} Ma`);
  });

  await t.test('All nodes have age_ma field', () => {
    const nodes_without_age = hypothesis.nodes.filter(n => !('age_ma' in n));
    assert.strictEqual(nodes_without_age.length, 0, 
      `All nodes should have age_ma field; ${nodes_without_age.length} missing`);
  });

  await t.test('Terminal ages are in valid range', () => {
    const terminals = hypothesis.nodes.filter(n => n.type === 'terminal');
    const ages = terminals.map(n => n.age_ma);
    
    const min_age = Math.min(...ages);
    const max_age = Math.max(...ages);
    
    assert(min_age >= 0, `Minimum terminal age should be >= 0, got ${min_age}`);
    assert(max_age <= TIMETREE_ROOT_AGE, 
      `Maximum terminal age should be <= ${TIMETREE_ROOT_AGE}, got ${max_age}`);
  });

  await t.test('Internal node ages are monotonically increasing toward root', () => {
    for (const node of hypothesis.nodes) {
      if (node.parentId !== null) {
        const parent = nodes_by_id[node.parentId];
        assert(parent.age_ma >= node.age_ma, 
          `Parent ${parent.id} (age ${parent.age_ma}) should be >= child ${node.id} (age ${node.age_ma})`);
      }
    }
  });

  await t.test('Branch length equals age difference between parent and child', () => {
    const tolerance = 0.00001;
    let consistent_count = 0;
    
    for (const node of hypothesis.nodes) {
      if (node.parentId !== null) {
        const parent = nodes_by_id[node.parentId];
        const age_diff = parent.age_ma - node.age_ma;
        const branch_length = node.branch_length || 0;
        
        if (Math.abs(age_diff - branch_length) < tolerance) {
          consistent_count++;
        } else {
          assert.fail(
            `Node ${node.id}: age_diff=${age_diff}, branch_length=${branch_length}, diff=${Math.abs(age_diff - branch_length)}`
          );
        }
      }
    }
    
    assert.strictEqual(consistent_count, 166, 
      `${consistent_count} nodes should satisfy branch-length consistency`);
  });

  await t.test('Age provenance is documented in sourceMetadata', () => {
    assert(hypothesis.sourceMetadata, 'sourceMetadata should exist');
    assert(hypothesis.sourceMetadata.ageData, 'sourceMetadata.ageData should exist');
    
    const ageData = hypothesis.sourceMetadata.ageData;
    assert.strictEqual(ageData.source, 'TimeTree 6', 'Age source should be TimeTree 6');
    assert.strictEqual(ageData.rootAge_ma, TIMETREE_ROOT_AGE, `Root age should be ${TIMETREE_ROOT_AGE}`);
    assert.strictEqual(ageData.ultrametric, true, 'Original TimeTree should be noted as ultrametric');
  });

  await t.test('Terminal count and correspondence', () => {
    const terminals = hypothesis.nodes.filter(n => n.type === 'terminal');
    assert.strictEqual(terminals.length, 57, 'Should have exactly 57 terminals');
    
    // All terminals should have a taxonId
    const terminals_with_taxon_id = terminals.filter(n => n.taxonId);
    assert.strictEqual(terminals_with_taxon_id.length, 57, 'All 57 terminals should have taxonId');
  });

  await t.test('Root-to-tip distances match accumulated branch lengths', () => {
    const terminals = hypothesis.nodes.filter(n => n.type === 'terminal');
    
    for (const terminal of terminals) {
      let accumulated = 0;
      let current = terminal;
      
      while (current.parentId !== null) {
        accumulated += current.branch_length || 0;
        current = nodes_by_id[current.parentId];
      }
      accumulated += current.branch_length || 0;
      
      const calculated_age = TIMETREE_ROOT_AGE - accumulated;
      const node_age = terminal.age_ma;
      
      assert(Math.abs(calculated_age - node_age) < 0.00001,
        `Terminal ${terminal.id}: calculated ${calculated_age}, stored ${node_age}`);
    }
  });

  await t.test('No nodes have negative ages', () => {
    const negative_ages = hypothesis.nodes.filter(n => n.age_ma < 0);
    assert.strictEqual(negative_ages.length, 0, 
      `No nodes should have negative ages; found ${negative_ages.length}`);
  });

  await t.test('Oldest terminals are younger than root', () => {
    const terminals = hypothesis.nodes.filter(n => n.type === 'terminal');
    const terminal_ages = terminals.map(n => n.age_ma);
    const max_terminal_age = Math.max(...terminal_ages);
    
    assert(max_terminal_age < TIMETREE_ROOT_AGE,
      `Oldest terminal (${max_terminal_age} Ma) should be < root (${TIMETREE_ROOT_AGE} Ma)`);
  });

  await t.test('Pruned tree is not ultrametric (terminals at different times)', () => {
    const terminals = hypothesis.nodes.filter(n => n.type === 'terminal');
    const ages = terminals.map(n => n.age_ma);
    const min_age = Math.min(...ages);
    const max_age = Math.max(...ages);
    const variance = max_age - min_age;
    
    // Original tree was ultrametric (variance 0), but after pruning it should have variance
    assert(variance > 1, 
      `Pruned tree should show variance in terminal ages (${variance} Ma); suggests successful pruning`);
  });
});
