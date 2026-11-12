/**
 * Test: SVG Asset Validation
 * 
 * Audits SVG production assets to verify they have correct properties.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

test('SVG Asset Validation', async (t) => {
  // Test 1: Verify manifest exists and has correct structure
  await t.test('PRODUCTION_MANIFEST.json exists and is valid', () => {
    const manifestPath = path.join(process.cwd(), 'assets/silhouettes/PRODUCTION_MANIFEST.json');
    assert.ok(fs.existsSync(manifestPath), 'Manifest file exists');
    
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    assert.ok(manifest.silhouetteMappings, 'Manifest has silhouetteMappings');
    assert.ok(Object.keys(manifest.silhouetteMappings).length > 0, 'silhouetteMappings has entries');
    
    // Check structure of a known entry
    const ratEntry = manifest.silhouetteMappings['rattus-norvegicus'];
    assert.ok(ratEntry, 'Brown Rat entry exists in manifest');
    assert.ok(ratEntry.taxonomyId, 'Brown Rat has taxonomyId');
    assert.ok(ratEntry.filename, 'Brown Rat has filename');
    assert.ok(ratEntry.commonName === 'Brown Rat', 'Brown Rat commonName is correct');
  });

  // Test 2: Verify production SVG files exist
  await t.test('Production SVG files exist on disk', () => {
    const manifestPath = path.join(process.cwd(), 'assets/silhouettes/PRODUCTION_MANIFEST.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    let productionCount = 0;
    let missingCount = 0;
    
    for (const [taxonId, entry] of Object.entries(manifest.silhouetteMappings)) {
      if (entry.status === 'MISSING') {
        missingCount++;
        // These are intentionally missing, so skip file check
        continue;
      }
      
      productionCount++;
      const filePath = path.join(process.cwd(), 'assets/silhouettes', entry.filename);
      assert.ok(fs.existsSync(filePath), `Production SVG exists: ${entry.filename}`);
    }
    
    assert.ok(productionCount > 0, 'Has production assets');
    assert.ok(missingCount > 0, 'Has intentionally missing assets marked');
  });

  // Test 3: Verify no placeholder or test SVGs in assets
  await t.test('No test or placeholder SVGs in production assets', () => {
    const assetsDir = path.join(process.cwd(), 'assets/silhouettes');
    const files = fs.readdirSync(assetsDir);
    
    const svgFiles = files.filter(f => f.endsWith('.svg'));
    for (const file of svgFiles) {
      assert.ok(!file.includes('test'), `No test SVGs: ${file}`);
      assert.ok(!file.includes('placeholder'), `No placeholder SVGs: ${file}`);
      assert.ok(!file.includes('missing'), `No missing SVGs: ${file}`);
    }
  });

  // Test 4: Verify Brown Rat SVG structure
  await t.test('Brown Rat SVG has valid structure', () => {
    const svgPath = path.join(process.cwd(), 'assets/silhouettes/rattus-norvegicus.svg');
    const content = fs.readFileSync(svgPath, 'utf8');
    
    // Check for viewBox
    assert.ok(content.includes('viewBox'), 'Has viewBox attribute');
    
    // SVGs are valid XML
    assert.ok(content.includes('<svg'), 'Has svg root element');
  });

  // Test 5: Verify Red Kangaroo SVG structure
  await t.test('Red Kangaroo SVG has valid structure', () => {
    const svgPath = path.join(process.cwd(), 'assets/silhouettes/macropus-rufus.svg');
    const content = fs.readFileSync(svgPath, 'utf8');
    
    // Check for viewBox
    assert.ok(content.includes('viewBox'), 'Has viewBox attribute');
    
    // SVGs are valid XML
    assert.ok(content.includes('<svg'), 'Has svg root element');
  });

  // Test 6: Verify missing taxa are properly marked
  await t.test('Missing taxa (Cuscus, Cattle, Chimpanzee) are marked correctly', () => {
    const manifestPath = path.join(process.cwd(), 'assets/silhouettes/PRODUCTION_MANIFEST.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    const cuscus = manifest.silhouetteMappings['phalanger-orientalis'];
    assert.ok(cuscus, 'Cuscus entry exists');
    assert.ok(cuscus.status === 'MISSING', 'Cuscus marked as MISSING');
    assert.ok(cuscus.reason, 'Cuscus has reason for missing status');
    
    const cattle = manifest.silhouetteMappings['bos-taurus'];
    assert.ok(cattle, 'Cattle entry exists');
    assert.ok(cattle.status === 'MISSING', 'Cattle marked as MISSING');
    
    const chimp = manifest.silhouetteMappings['pan-troglodytes'];
    assert.ok(chimp, 'Chimpanzee entry exists');
    assert.ok(chimp.status === 'MISSING', 'Chimpanzee marked as MISSING');
  });

  // Test 7: Verify no SVG files contain rect elements with fills that might look like backgrounds
  await t.test('Production SVGs do not have background rectangles', () => {
    const manifestPath = path.join(process.cwd(), 'assets/silhouettes/PRODUCTION_MANIFEST.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    for (const [taxonId, entry] of Object.entries(manifest.silhouetteMappings)) {
      if (entry.status === 'MISSING') continue;
      
      const svgPath = path.join(process.cwd(), 'assets/silhouettes', entry.filename);
      const content = fs.readFileSync(svgPath, 'utf8');
      
      // Look for suspicious rect elements (large rects that might be backgrounds)
      // They usually have width/height close to viewBox dimensions
      const hasBackgroundRect = content.includes('<rect') && 
                               (content.includes('fill="#F') || 
                                content.includes('fill="rgb(') ||
                                content.includes('fill="#E'));
      
      assert.ok(!hasBackgroundRect, 
        `${entry.filename} does not have a background rectangle`);
    }
  });
});
