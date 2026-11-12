import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Silhouette Assets Integration', async (t) => {
  const silhouettesDir = path.join(__dirname, '../../assets/silhouettes');
  
  await t.test('all 21 silhouette SVG files exist', () => {
    const mapping = JSON.parse(
      fs.readFileSync(path.join(silhouettesDir, 'SILHOUETTE_MAPPING.json'), 'utf-8')
    );
    
    Object.values(mapping.silhouetteMappings).forEach(spec => {
      const filepath = path.join(silhouettesDir, spec.filename);
      assert.ok(fs.existsSync(filepath), `${spec.filename} should exist`);
    });
  });

  await t.test('all silhouette files are valid SVG', () => {
    const mapping = JSON.parse(
      fs.readFileSync(path.join(silhouettesDir, 'SILHOUETTE_MAPPING.json'), 'utf-8')
    );
    
    Object.values(mapping.silhouetteMappings).forEach(spec => {
      const filepath = path.join(silhouettesDir, spec.filename);
      const content = fs.readFileSync(filepath, 'utf-8');
      
      assert.match(content, /<svg/, `${spec.filename} should contain <svg tag`);
      assert.match(content, /<\/svg>/, `${spec.filename} should contain </svg> tag`);
      assert.match(content, /xmlns="http:\/\/www.w3.org\/2000\/svg"/, `${spec.filename} should have SVG namespace`);
    });
  });

  await t.test('SILHOUETTE_MAPPING has correct structure', () => {
    const mapping = JSON.parse(
      fs.readFileSync(path.join(silhouettesDir, 'SILHOUETTE_MAPPING.json'), 'utf-8')
    );
    
    assert.ok(mapping.silhouetteMappings, 'should have silhouetteMappings');
    assert.ok(mapping.metadata, 'should have metadata');
    assert.equal(mapping.metadata.totalSpecies, 21, 'should have 21 species');
    assert.equal(mapping.metadata.allTerminalSpeciesCovered, true, 'all species should be covered');
  });

  await t.test('each mapping has required fields', () => {
    const mapping = JSON.parse(
      fs.readFileSync(path.join(silhouettesDir, 'SILHOUETTE_MAPPING.json'), 'utf-8')
    );
    
    Object.values(mapping.silhouetteMappings).forEach(spec => {
      assert.ok(spec.taxonomyId, 'should have taxonomyId');
      assert.ok(spec.scientificName, 'should have scientificName');
      assert.ok(spec.commonName, 'should have commonName');
      assert.ok(spec.filename, 'should have filename');
      assert.equal(typeof spec.taxonomyId, 'string', 'taxonomyId should be string');
      assert.equal(typeof spec.scientificName, 'string', 'scientificName should be string');
      assert.equal(typeof spec.commonName, 'string', 'commonName should be string');
      assert.equal(typeof spec.filename, 'string', 'filename should be string');
    });
  });

  await t.test('ASSET_MANIFEST exists and is valid', () => {
    const manifestPath = path.join(silhouettesDir, 'ASSET_MANIFEST.json');
    assert.ok(fs.existsSync(manifestPath), 'ASSET_MANIFEST.json should exist');
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.ok(manifest.silhouetteAssets, 'should have silhouetteAssets');
    assert.ok(Array.isArray(manifest.silhouetteAssets), 'silhouetteAssets should be array');
    assert.equal(manifest.silhouetteAssets.length, 21, 'should have 21 assets');
  });

  await t.test('LICENSING documentation exists', () => {
    const licensingPath = path.join(silhouettesDir, 'LICENSING.md');
    assert.ok(fs.existsSync(licensingPath), 'LICENSING.md should exist');
    
    const content = fs.readFileSync(licensingPath, 'utf-8');
    assert.match(content, /CC0 1.0 Universal/, 'should mention CC0 1.0 Universal');
    assert.match(content, /silhouette/, 'should mention silhouette');
  });

  await t.test('silhouette files are reasonably sized SVGs', () => {
    const mapping = JSON.parse(
      fs.readFileSync(path.join(silhouettesDir, 'SILHOUETTE_MAPPING.json'), 'utf-8')
    );
    
    Object.values(mapping.silhouetteMappings).forEach(spec => {
      const filepath = path.join(silhouettesDir, spec.filename);
      const stats = fs.statSync(filepath);
      
      // Each silhouette should be less than 5KB (reasonable SVG size)
      assert.ok(stats.size < 5000, `${spec.filename} size ${stats.size} should be less than 5KB`);
      assert.ok(stats.size > 100, `${spec.filename} size ${stats.size} should be greater than 100 bytes`);
    });
  });
});
