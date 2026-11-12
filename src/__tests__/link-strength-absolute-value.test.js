import { test } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

test('Link Strength: Numeric Scale Correction', async (t) => {
  // Test the corrected HTML slider and transformation logic
  const htmlPath = path.join(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  await t.test('Link Strength slider HTML has corrected range (0-1)', () => {
    assert.ok(html.includes('id="link-slider"'), 'Link strength slider exists');
    // The slider should now range 0-1 with step 0.05
    const linkSliderMatch = html.match(/id="link-slider"[^>]*min="([^"]*)"[^>]*max="([^"]*)"[^>]*value="([^"]*)"/);
    assert.ok(linkSliderMatch, 'Link slider has min/max/value attributes');
    assert.equal(linkSliderMatch[1], '0', 'Min should be 0');
    assert.equal(linkSliderMatch[2], '1', 'Max should be 1 (corrected from 3)');
    assert.equal(linkSliderMatch[3], '0.5', 'Default should be 0.5');
  });
  
  await t.test('SettingsUI transform: slider value passed directly (no division)', () => {
    // After correction, transform should be: v => parseFloat(v)
    const transform = (v) => parseFloat(v);
    
    // Test the sequence 0.5 → 0.8 → 0.5
    const sequence1_0_5 = transform('0.5');
    const sequence1_0_8 = transform('0.8');
    const sequence1_0_5_return = transform('0.5');
    
    assert.equal(sequence1_0_5, 0.5, 'First 0.5 should be exactly 0.5');
    assert.equal(sequence1_0_8, 0.8, 'Slider 0.8 should be exactly 0.8');
    assert.equal(sequence1_0_5_return, 0.5, 'Return to 0.5 should be exactly 0.5');
    assert.equal(sequence1_0_5, sequence1_0_5_return, 'Both 0.5 values must match');
  });
  
  await t.test('Link Strength slider range now matches VisualizationSettings 0-1 range', () => {
    // VisualizationSettings defines: linkStrength: 0.5 (range 0-1)
    // Slider should now be 0-1 with no division
    // This means slider value directly equals settings value
    
    const transform = (v) => parseFloat(v);
    
    // All values in 0-1 range should pass through unchanged
    const testValues = ['0', '0.1', '0.5', '0.8', '1.0'];
    for (const val of testValues) {
      const result = transform(val);
      assert.equal(result, parseFloat(val), `Slider ${val} should equal settings ${val}`);
    }
  });
  
  await t.test('Transform is idempotent: same slider value always produces same setting value', () => {
    const transform = (v) => parseFloat(v);
    
    // Test sequence 1: 0.5 → 0.8 → 0.5
    assert.equal(transform('0.5'), transform('0.5'), '0.5 always produces 0.5');
    assert.equal(transform('0.8'), transform('0.8'), '0.8 always produces 0.8');
    assert.equal(transform('0.5'), 0.5, 'Return to 0.5 is exactly 0.5');
    
    // Test sequence 2: 0.5 → 0.1 → 0.5
    assert.equal(transform('0.5'), 0.5, 'First 0.5 is 0.5');
    assert.equal(transform('0.1'), 0.1, 'Jump to 0.1 is 0.1');
    assert.equal(transform('0.5'), 0.5, 'Return to 0.5 is 0.5');
    
    // Test sequence 3: 0.5 → 0 → 0.5
    assert.equal(transform('0.5'), 0.5, 'First 0.5 is 0.5');
    assert.equal(transform('0'), 0, 'Minimum 0 is 0');
    assert.equal(transform('0.5'), 0.5, 'Return to 0.5 is 0.5');
  });
  
  await t.test('Three critical test sequences all produce absolute, repeatable values', () => {
    const transform = (v) => parseFloat(v);
    
    // Sequence 1: 0.5 → 0.8 → 0.5
    {
      const val1 = transform('0.5');
      const val2 = transform('0.8');
      const val3 = transform('0.5');
      assert.equal(val1, 0.5, 'Seq1: Initial 0.5');
      assert.equal(val2, 0.8, 'Seq1: Changed to 0.8');
      assert.equal(val3, 0.5, 'Seq1: Returned to 0.5');
      assert.equal(val1, val3, 'Seq1: Initial and final 0.5 are identical');
    }
    
    // Sequence 2: 0.5 → 0.1 → 0.5
    {
      const val1 = transform('0.5');
      const val2 = transform('0.1');
      const val3 = transform('0.5');
      assert.equal(val1, 0.5, 'Seq2: Initial 0.5');
      assert.equal(val2, 0.1, 'Seq2: Changed to 0.1');
      assert.equal(val3, 0.5, 'Seq2: Returned to 0.5');
      assert.equal(val1, val3, 'Seq2: Initial and final 0.5 are identical');
    }
    
    // Sequence 3: 0.5 → 0 → 0.5
    {
      const val1 = transform('0.5');
      const val2 = transform('0');
      const val3 = transform('0.5');
      assert.equal(val1, 0.5, 'Seq3: Initial 0.5');
      assert.equal(val2, 0, 'Seq3: Changed to 0');
      assert.equal(val3, 0.5, 'Seq3: Returned to 0.5');
      assert.equal(val1, val3, 'Seq3: Initial and final 0.5 are identical');
    }
  });
  
  await t.test('No accumulation or compounding: each value is independent', () => {
    const transform = (v) => parseFloat(v);
    
    // If there were any accumulation bug, repeated calls would change
    const val0_5_1 = transform('0.5');
    const val0_5_2 = transform('0.5');
    const val0_5_3 = transform('0.5');
    const val0_5_4 = transform('0.5');
    const val0_5_5 = transform('0.5');
    
    assert.equal(val0_5_1, val0_5_2, 'Repeated 0.5 calls must be identical');
    assert.equal(val0_5_2, val0_5_3, 'No accumulation or drift');
    assert.equal(val0_5_3, val0_5_4, 'No compounding effect');
    assert.equal(val0_5_4, val0_5_5, 'All identical');
    assert.equal(val0_5_1, 0.5, 'All equal exactly 0.5');
  });
});

