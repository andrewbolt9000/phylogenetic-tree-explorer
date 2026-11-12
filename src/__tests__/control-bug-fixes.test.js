import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

test('Part A: Sidebar Font Size Control Bug Fixes', async (t) => {
  await t.test('CSS uses CSS variable for font sizing, not hardcoded pixels', () => {
    const indexContent = fs.readFileSync('./index.html', 'utf-8');
    
    // Check that h1 uses CSS variable
    assert.match(indexContent, /h1\s*\{[^}]*font-size:\s*calc\(var\(--sidebar-font-size\)/,
      'h1 should use calc(var(--sidebar-font-size))');
    
    // Check that h2 uses CSS variable
    assert.match(indexContent, /h2\s*\{[^}]*font-size:\s*var\(--sidebar-font-size\)/,
      'h2 should use var(--sidebar-font-size)');
    
    // Check that .control-label uses CSS variable
    assert.match(indexContent, /\.control-label\s*\{[^}]*font-size:\s*calc\(var\(--sidebar-font-size\)/,
      '.control-label should use calc(var(--sidebar-font-size))');
    
    // Check that .stats uses CSS variable
    assert.match(indexContent, /\.stats\s*\{[^}]*font-size:\s*calc\(var\(--sidebar-font-size\)/,
      '.stats should use calc(var(--sidebar-font-size))');
    
    // Check that button uses CSS variable
    assert.match(indexContent, /button\s*\{[^}]*font-size:\s*calc\(var\(--sidebar-font-size\)/,
      'button should use calc(var(--sidebar-font-size))');
    
    // Check that .checkbox-label uses CSS variable
    assert.match(indexContent, /\.checkbox-label\s*\{[^}]*font-size:\s*var\(--sidebar-font-size\)/,
      '.checkbox-label should use var(--sidebar-font-size)');
    
    // Check that .legend uses CSS variable
    assert.match(indexContent, /\.legend\s*\{[^}]*font-size:\s*calc\(var\(--sidebar-font-size\)/,
      '.legend should use calc(var(--sidebar-font-size))');
    
    // Check that .info-text uses CSS variable
    assert.match(indexContent, /\.info-text\s*\{[^}]*font-size:\s*calc\(var\(--sidebar-font-size\)/,
      '.info-text should use calc(var(--sidebar-font-size))');
  });

  await t.test('no hardcoded font-size pixels in sidebar CSS classes', () => {
    const indexContent = fs.readFileSync('./index.html', 'utf-8');
    
    // Extract the CSS from the style tag
    const styleMatch = indexContent.match(/<style>([\s\S]*?)<\/style>/);
    assert.ok(styleMatch, 'should have style tag');
    
    const css = styleMatch[1];
    
    // Specific checks: these classes should NOT have hardcoded px values
    const classesToCheck = [
      'h1', 'h2', '.control-label', '.stats', 'button', 
      '.checkbox-label', '.legend', '.info-text'
    ];
    
    classesToCheck.forEach(className => {
      // Build a pattern to find the class rule
      const classPattern = new RegExp(`${className}\\s*\\{[^}]*font-size:`, 'i');
      const ruleMatch = css.match(classPattern);
      
      if (ruleMatch) {
        // Make sure it's using var() or calc(var())
        const fullRulePattern = new RegExp(`${className}\\s*\\{[^}]*font-size:\\s*[^;]+`, 'i');
        const fullRule = css.match(fullRulePattern);
        
        if (fullRule && !fullRule[0].includes('var(') && !fullRule[0].includes('px')) {
          // It's okay if there's no font-size at all
          return;
        }
        
        if (fullRule && fullRule[0].includes('px') && !fullRule[0].includes('var(')) {
          assert.fail(`${className} should not have hardcoded px value: ${fullRule[0]}`);
        }
      }
    });
  });
});

test('Part B: Repulsion Charge Control Bug Fixes', async (t) => {
  await t.test('slider uses positive UI range (0-1500)', () => {
    const indexContent = fs.readFileSync('./index.html', 'utf-8');
    
    // Check slider min/max attributes
    assert.match(indexContent, /<input[^>]*id="charge-slider"[^>]*min="0"/,
      'charge-slider should have min="0"');
    
    assert.match(indexContent, /<input[^>]*id="charge-slider"[^>]*max="1500"/,
      'charge-slider should have max="1500"');
    
    assert.match(indexContent, /<input[^>]*id="charge-slider"[^>]*value="300"/,
      'charge-slider should have value="300" (positive default)');
  });

  await t.test('charge slider event listener maps UI value to D3 negative value', () => {
    const indexContent = fs.readFileSync('./index.html', 'utf-8');
    
    // Find the event listener code
    assert.match(indexContent, /chargeSlider\.addEventListener.*?uiValue.*?-uiValue/s,
      'charge slider should map UI value to negative D3 value');
    
    // Verify zero case is handled
    assert.match(indexContent, /uiValue === 0 \? 0 : -uiValue/,
      'should handle zero case (0 -> 0, not 0 -> -0)');
  });

  await t.test('charge slider help text is updated', () => {
    const indexContent = fs.readFileSync('./index.html', 'utf-8');
    
    // Check that the help text no longer mentions negative values
    assert.match(indexContent, /Higher values increase repulsion/,
      'help text should explain positive values increase repulsion');
    
    assert.match(indexContent, /Zero disables repulsion/,
      'help text should mention that zero disables repulsion');
  });
});
