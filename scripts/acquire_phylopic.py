#!/usr/bin/env python3
"""
PhyloPic Asset Discovery Script

Systematically searches for and downloads animal silhouettes from PhyloPic
for the 21 mammalian taxa in the phylogenetic tree dataset.

API Documentation: https://api-docs.phylopic.org/v2/index.html
"""

import os
import json
import sys
import time
import requests
from pathlib import Path
from typing import Optional, Dict, List, Any
import urllib.parse

# Configuration
PHYLOPIC_API = "https://api.phylopic.org"
BUILD = "562"  # Current PhyloPic build
RATE_LIMIT_DELAY = 0.5  # seconds between API calls
DOWNLOAD_TIMEOUT = 10
CACHE_FILE = "scripts/phylopic_cache.json"

# Terminal taxa from data/mammals/hypothesis.json
TERMINAL_TAXA = [
    {"scientific_name": "Homo sapiens", "common_name": "Human"},
    {"scientific_name": "Pan troglodytes", "common_name": "Common Chimpanzee"},
    {"scientific_name": "Pan paniscus", "common_name": "Bonobo"},
    {"scientific_name": "Gorilla gorilla", "common_name": "Western Lowland Gorilla"},
    {"scientific_name": "Pongo pygmaeus", "common_name": "Bornean Orangutan"},
    {"scientific_name": "Macaca mulatta", "common_name": "Rhesus Macaque"},
    {"scientific_name": "Sciurus vulgaris", "common_name": "Red Squirrel"},
    {"scientific_name": "Mus musculus", "common_name": "House Mouse"},
    {"scientific_name": "Rattus norvegicus", "common_name": "Brown Rat"},
    {"scientific_name": "Canis lupus", "common_name": "Gray Wolf"},
    {"scientific_name": "Felis catus", "common_name": "Domestic Cat"},
    {"scientific_name": "Panthera leo", "common_name": "Lion"},
    {"scientific_name": "Panthera pardus", "common_name": "Leopard"},
    {"scientific_name": "Balaenoptera musculus", "common_name": "Blue Whale"},
    {"scientific_name": "Tursiops truncatus", "common_name": "Bottlenose Dolphin"},
    {"scientific_name": "Cervus elaphus", "common_name": "Red Deer"},
    {"scientific_name": "Bos taurus", "common_name": "Domestic Cattle"},
    {"scientific_name": "Artibeus lituratus", "common_name": "Great Fruit Bat"},
    {"scientific_name": "Macropus rufus", "common_name": "Red Kangaroo"},
    {"scientific_name": "Phalanger orientalis", "common_name": "Common Cuscus"},
    {"scientific_name": "Ornithorhynchus anatinus", "common_name": "Platypus"},
]

class PhyloPicDiscovery:
    def __init__(self):
        self.cache = self._load_cache()
        self.results = {}
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'PhyloExplorer/1.0 (phylogenetic visualization)'
        })
    
    def _load_cache(self) -> Dict:
        """Load cached API responses."""
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r') as f:
                return json.load(f)
        return {}
    
    def _save_cache(self):
        """Save cache to disk."""
        os.makedirs("scripts", exist_ok=True)
        with open(CACHE_FILE, 'w') as f:
            json.dump(self.cache, f, indent=2)
    
    def _get(self, endpoint: str, params: Dict = None) -> Optional[Dict]:
        """Make a GET request to PhyloPic API with caching."""
        url = f"{PHYLOPIC_API}{endpoint}"
        
        # Create cache key
        cache_key = f"{endpoint}?{urllib.parse.urlencode(sorted((params or {}).items()))}"
        
        # Check cache
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Rate limiting
        time.sleep(RATE_LIMIT_DELAY)
        
        try:
            if params is None:
                params = {}
            params['build'] = BUILD
            
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            self.cache[cache_key] = data
            return data
            
        except requests.RequestException as e:
            return None
    
    def search_taxon(self, scientific_name: str, common_name: str) -> Dict:
        """Search for images of a single taxon."""
        print(f"\n{'='*60}")
        print(f"{common_name} ({scientific_name})")
        print(f"{'='*60}")
        
        result = {
            "common_name": common_name,
            "scientific_name": scientific_name,
            "candidates": [],
            "status": "NOT_FOUND",
            "notes": []
        }
        
        # Try progressively broader searches
        search_levels = [
            (scientific_name, "species"),
            (scientific_name.split()[0], "genus"),
        ]
        
        for query_term, level in search_levels:
            print(f"\nSearching {level}: '{query_term}'")
            
            # Step 1: Get nodes for this name (filter_name is case-sensitive, must be lowercase)
            nodes_data = self._get("/nodes", {"filter_name": query_term.lower(), "page": "0", "embed_items": "true"})
            
            if not nodes_data or '_embedded' not in nodes_data:
                print(f"  No nodes found")
                continue
            
            items = nodes_data.get('_embedded', {}).get('items', [])
            if not items:
                print(f"  No nodes found")
                continue
            
            print(f"  Found {len(items)} node(s)")
            
            # Get the first matching node
            node = items[0]
            node_uuid = node.get('uuid')
            node_name = node.get('title', query_term)
            print(f"  Using: {node_name} (UUID: {node_uuid})")
            
            # Step 2: Get images for this node
            images_data = self._get("/images", {
                "filter_clade": node_uuid,
                "page": "0",
                "embed_items": "true"
            })
            
            if not images_data or '_embedded' not in images_data:
                print(f"  No images found")
                continue
            
            image_items = images_data.get('_embedded', {}).get('items', [])
            if not image_items:
                print(f"  No images found")
                continue
            
            print(f"  Found {len(image_items)} image(s), processing top 5...")
            
            # Process images
            for img_item in image_items[:5]:
                candidate = self._process_image(img_item)
                if candidate:
                    result["candidates"].append(candidate)
            
            # If we found candidates, mark as successful and stop searching
            if result["candidates"]:
                result["status"] = f"FOUND_{level.upper()}"
                print(f"  ✓ {len(result['candidates'])} suitable candidate(s)")
                break
        
        # Summary
        if not result["candidates"]:
            print(f"\n  STATUS: NOT_FOUND")
            result["notes"].append(f"No suitable images found in PhyloPic for {scientific_name}")
        else:
            print(f"\n  STATUS: {result['status']}")
        
        return result
    
    def _process_image(self, img_item: Dict) -> Optional[Dict]:
        """Fetch full image details and extract candidate information."""
        try:
            uuid = img_item.get('uuid')
            
            # Fetch full image details to get sourceFile link
            img_detail = self._get(f"/images/{uuid}", {})
            if not img_detail:
                return None
            
            title = img_detail.get('title', 'Untitled')
            
            # Get contributor
            contributor_link = img_detail.get('_links', {}).get('contributor', {})
            contributor = contributor_link.get('title', 'Unknown')
            
            # Get license
            license_link = img_detail.get('_links', {}).get('license', {})
            license_url = license_link.get('href', '')
            license_title = 'Unknown'
            has_restrictions = False
            restrictions = []
            
            if 'creativecommons.org' in license_url:
                if 'zero' in license_url or 'publicdomain' in license_url:
                    license_title = 'CC0 1.0 / Public Domain'
                elif 'by/' in license_url:
                    license_title = 'CC-BY'
                    if '-nc' in license_url or 'noncommercial' in license_url:
                        has_restrictions = True
                        restrictions.append("NonCommercial")
                    if '-sa' in license_url or 'sharelike' in license_url:
                        has_restrictions = True
                        restrictions.append("ShareAlike")
            
            # Get source file (SVG)
            files = img_detail.get('_links', {})
            source_file = files.get('sourceFile', {}).get('href')
            
            if not source_file:
                print(f"    Skipping {uuid}: no vector file")
                return None
            
            # Get specific and general nodes
            specific_node = img_detail.get('_links', {}).get('specificNode', {}).get('title', 'Unknown')
            general_node = img_detail.get('_links', {}).get('generalNode', {}).get('title', 'Unknown')
            
            taxonomic_level = "species" if specific_node != "Unknown" else "genus"
            
            print(f"    ✓ {title} ({license_title})")
            if restrictions:
                print(f"      Restrictions: {', '.join(restrictions)}")
            
            return {
                "uuid": uuid,
                "title": title,
                "contributor": contributor,
                "license": {
                    "title": license_title,
                    "url": license_url,
                    "has_restrictions": has_restrictions,
                    "restrictions": restrictions
                },
                "vector_url": source_file,
                "phylopic_url": f"https://www.phylopic.org/images/{uuid}",
                "specific_node": specific_node,
                "general_node": general_node,
                "taxonomic_level": taxonomic_level,
                "downloaded": False,
                "download_filename": None
            }
        
        except Exception as e:
            print(f"    Error processing image {img_item.get('uuid')}: {e}")
            return None
    
    def download_candidates(self):
        """Download SVG files for all candidates."""
        download_dir = Path("scripts/phylopic_candidates")
        download_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"\n\n{'='*60}")
        print(f"DOWNLOADING CANDIDATE SVGs")
        print(f"{'='*60}")
        
        total_downloaded = 0
        total_failed = 0
        
        for result in self.results.values():
            if result["status"] == "NOT_FOUND":
                continue
            
            print(f"\n{result['common_name']}")
            
            for i, candidate in enumerate(result["candidates"]):
                if candidate.get("downloaded"):
                    continue
                
                try:
                    url = candidate["vector_url"]
                    uuid = candidate["uuid"]
                    filename = f"{uuid}.svg"
                    filepath = download_dir / filename
                    
                    print(f"  [{i+1}] {filename}...", end=" ", flush=True)
                    
                    # Fetch the file
                    resp = self.session.get(url, timeout=DOWNLOAD_TIMEOUT)
                    resp.raise_for_status()
                    
                    content = resp.text
                    content_type = resp.headers.get('content-type', '').lower()
                    
                    # Validate SVG content (check for svg tag anywhere in content, not just first 100 chars)
                    if '<svg' not in content.lower():
                        print(f"SKIP (not SVG, content-type: {content_type})")
                        candidate["download_status"] = "SKIP_NOT_SVG"
                        candidate["error"] = f"File does not contain SVG markup. Content-Type: {content_type}"
                        total_failed += 1
                        continue
                    
                    # Validate file size (reject empty files)
                    if len(content) < 100:
                        print(f"SKIP (file too small: {len(content)} bytes)")
                        candidate["download_status"] = "SKIP_TOO_SMALL"
                        candidate["error"] = f"File too small: {len(content)} bytes"
                        total_failed += 1
                        continue
                    
                    # Save file
                    with open(filepath, 'w') as f:
                        f.write(content)
                    
                    candidate["downloaded"] = True
                    candidate["download_filename"] = filename
                    candidate["file_size"] = len(content)
                    candidate["download_status"] = "DOWNLOADED"
                    candidate["download_timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    total_downloaded += 1
                    
                    print(f"OK ({len(content)} bytes)")
                    
                except requests.exceptions.Timeout:
                    print(f"FAIL (timeout)")
                    candidate["download_status"] = "DOWNLOAD_TIMEOUT"
                    candidate["error"] = "HTTP timeout"
                    total_failed += 1
                except requests.exceptions.HTTPError as e:
                    print(f"FAIL (HTTP {e.response.status_code})")
                    candidate["download_status"] = f"HTTP_ERROR_{e.response.status_code}"
                    candidate["error"] = f"HTTP error {e.response.status_code}"
                    total_failed += 1
                except Exception as e:
                    print(f"FAIL ({type(e).__name__})")
                    candidate["download_status"] = "DOWNLOAD_ERROR"
                    candidate["error"] = str(e)
                    total_failed += 1
                
                time.sleep(RATE_LIMIT_DELAY)
        
        print(f"\n✓ Downloaded {total_downloaded} candidate SVGs")
        print(f"✗ Failed to download {total_failed} candidates")
    
    def generate_html_catalog(self):
        """Generate an HTML contact sheet of candidates."""
        catalog_file = Path("scripts/phylopic_catalog.html")
        
        print(f"\n\n{'='*60}")
        print(f"GENERATING HTML CATALOG")
        print(f"{'='*60}")
        
        found_count = sum(1 for r in self.results.values() if r["status"] != "NOT_FOUND")
        not_found_count = len(self.results) - found_count
        
        # Build HTML manually to avoid format string issues with CSS
        html_parts = [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '  <meta charset="UTF-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '  <title>PhyloPic Discovery Catalog</title>',
            '  <style>',
            '    * { margin: 0; padding: 0; box-sizing: border-box; }',
            '    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; padding: 40px 20px; }',
            '    .container { max-width: 1400px; margin: 0 auto; }',
            '    h1 { text-align: center; margin-bottom: 10px; color: #333; }',
            '    .header-info { text-align: center; color: #666; margin-bottom: 40px; font-size: 14px; }',
            '    .species-section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }',
            '    .species-title { font-size: 18px; font-weight: 600; color: #2E86AB; margin-bottom: 8px; border-bottom: 2px solid #E8E8E8; padding-bottom: 8px; }',
            '    .species-scientific { font-size: 14px; color: #999; font-style: italic; margin-bottom: 16px; }',
            '    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px; margin-right: 8px; }',
            '    .status.species { background: #C8E6C9; color: #2E7D32; }',
            '    .status.genus { background: #FFE0B2; color: #E65100; }',
            '    .status.higher { background: #BBDEFB; color: #0D47A1; }',
            '    .status.not-found { background: #FFCDD2; color: #C62828; }',
            '    .download-status { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-left: 8px; }',
            '    .download-status.downloaded { background: #81C784; color: white; }',
            '    .download-status.failed { background: #E57373; color: white; }',
            '    .candidates { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }',
            '    .candidate { border: 1px solid #E8E8E8; border-radius: 4px; padding: 16px; background: #FAFAFA; }',
            '    .candidate.downloaded { border-left: 4px solid #81C784; }',
            '    .candidate.failed { border-left: 4px solid #E57373; }',
            '    .candidate:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-color: #2E86AB; }',
            '    .candidate-image { width: 100%; height: 200px; display: flex; align-items: center; justify-content: center; background: white; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 12px; overflow: hidden; }',
            '    .candidate-image img { max-width: 100%; max-height: 100%; }',
            '    .candidate-image.no-image { color: #999; font-size: 12px; text-align: center; }',
            '    .candidate-info { font-size: 12px; color: #666; line-height: 1.6; }',
            '    .candidate-info-row { margin-bottom: 6px; }',
            '    .candidate-info-label { font-weight: 600; color: #333; display: inline-block; width: 80px; }',
            '    .error-message { background: #FFEBEE; border-left: 3px solid #E57373; padding: 8px; border-radius: 3px; margin-top: 8px; font-size: 11px; color: #C62828; }',
            '    .restriction { display: inline-block; background: #FFE082; color: #F57F17; padding: 2px 6px; border-radius: 2px; font-size: 11px; margin: 2px 2px 2px 0; }',
            '    .phylopic-link { display: inline-block; margin-top: 8px; color: #2E86AB; text-decoration: none; font-weight: 600; }',
            '    .notes { background: #FFF3CD; border-left: 4px solid #FFC107; padding: 12px; border-radius: 4px; font-size: 13px; color: #856404; }',
            '    .summary { background: #E3F2FD; border-left: 4px solid #2196F3; padding: 12px; border-radius: 4px; margin-top: 20px; }',
            '  </style>',
            '</head>',
            '<body>',
            '  <div class="container">',
            '    <h1>PhyloPic Discovery Catalog</h1>',
            '    <div class="header-info">',
            f'      Generated using PhyloPic API (build {BUILD})<br>',
            '      21 Mammalian species from phylogenetic dataset',
            '    </div>',
        ]
        
        # Count statistics
        downloaded_count = 0
        species_with_svg = 0
        species_genus_level = 0
        species_higher_level = 0
        species_not_found = 0
        
        # Add species sections
        for species_key in sorted(self.results.keys()):
            result = self.results[species_key]
            candidates = result['candidates']
            
            # Count stats
            if result["status"] == "NOT_FOUND":
                species_not_found += 1
                status_class = "not-found"
                status_text = "NOT FOUND"
            elif "GENUS" in result["status"]:
                species_genus_level += 1
                status_class = "genus"
                status_text = "FOUND GENUS"
            elif "HIGHER" in result["status"]:
                species_higher_level += 1
                status_class = "higher"
                status_text = "FOUND HIGHER TAXON"
            else:
                species_with_svg += 1
                status_class = "species"
                status_text = "FOUND SPECIES"
            
            html_parts.append('    <div class="species-section">')
            html_parts.append(f'      <div class="species-title">{result["common_name"]}</div>')
            html_parts.append(f'      <div class="species-scientific">{result["scientific_name"]}</div>')
            html_parts.append(f'      <div class="status {status_class}">{status_text}</div>')
            
            if candidates:
                html_parts.append('      <div class="candidates">')
                
                for candidate in candidates:
                    downloaded = candidate.get("downloaded", False)
                    download_status = candidate.get("download_status", "UNKNOWN")
                    candidate_class = "downloaded" if downloaded else "failed"
                    
                    if downloaded:
                        downloaded_count += 1
                        image_html = f'<img src="phylopic_candidates/{candidate["download_filename"]}" alt="silhouette">'
                        status_badge = '<span class="download-status downloaded">✓ Downloaded</span>'
                    else:
                        image_html = f'<div class="no-image">Not downloaded<br>{download_status}</div>'
                        status_badge = f'<span class="download-status failed">✗ {download_status}</span>'
                    
                    restrictions_html = ""
                    if candidate["license"]["restrictions"]:
                        for r in candidate["license"]["restrictions"]:
                            restrictions_html += f'<div class="restriction">{r}</div>'
                    
                    html_parts.append(f'        <div class="candidate {candidate_class}">')
                    html_parts.append('          <div class="candidate-image">')
                    html_parts.append(f'            {image_html}')
                    html_parts.append('          </div>')
                    html_parts.append('          <div class="candidate-info">')
                    html_parts.append(f'            <div class="candidate-info-row"><span class="candidate-info-label">UUID:</span> {candidate["uuid"][:8]}...{status_badge}</div>')
                    html_parts.append(f'            <div class="candidate-info-row"><span class="candidate-info-label">Level:</span> {candidate["taxonomic_level"].upper()}</div>')
                    html_parts.append(f'            <div class="candidate-info-row"><span class="candidate-info-label">License:</span> {candidate["license"]["title"]}</div>')
                    
                    if restrictions_html:
                        html_parts.append(f'            <div class="candidate-info-row">{restrictions_html}</div>')
                    
                    html_parts.append(f'            <div class="candidate-info-row"><span class="candidate-info-label">By:</span> {candidate["contributor"]}</div>')
                    html_parts.append(f'            <a href="{candidate["phylopic_url"]}" class="phylopic-link" target="_blank">View on PhyloPic →</a>')
                    
                    if candidate.get("error"):
                        html_parts.append(f'            <div class="error-message">{candidate["error"]}</div>')
                    
                    html_parts.append('          </div>')
                    html_parts.append('        </div>')
                
                html_parts.append('      </div>')
            
            if result["notes"]:
                for note in result["notes"]:
                    html_parts.append(f'      <div class="notes">{note}</div>')
            
            html_parts.append('    </div>')
        
        # Add summary
        html_parts.append('    <div class="species-section">')
        html_parts.append('      <h2>Summary</h2>')
        html_parts.append('      <div class="summary">')
        html_parts.append(f'        <strong>Species-level matches:</strong> {species_with_svg}/21<br>')
        html_parts.append(f'        <strong>Genus-level matches:</strong> {species_genus_level}/21<br>')
        html_parts.append(f'        <strong>Higher-level matches:</strong> {species_higher_level}/21<br>')
        html_parts.append(f'        <strong>Not found:</strong> {species_not_found}/21<br>')
        html_parts.append(f'        <br>')
        html_parts.append(f'        <strong>Successfully downloaded SVGs:</strong> {downloaded_count} images<br>')
        html_parts.append(f'        <strong>Failed or skipped:</strong> {sum(len(r["candidates"]) for r in self.results.values() if r["status"] != "NOT_FOUND") - downloaded_count} candidates')
        html_parts.append('      </div>')
        html_parts.append('    </div>')
        
        html_parts.extend(['  </div>', '</body>', '</html>'])
        
        html = '\n'.join(html_parts)
        
        with open(catalog_file, 'w') as f:
            f.write(html)
        
        print(f"✓ Catalog saved to {catalog_file}")
        return catalog_file
    
    def generate_json_report(self):
        """Generate machine-readable discovery report."""
        report_file = Path("scripts/phylopic_discovery.json")
        
        report = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "build": BUILD,
            "total_species": len(self.results),
            "found": sum(1 for r in self.results.values() if r["status"] != "NOT_FOUND"),
            "not_found": sum(1 for r in self.results.values() if r["status"] == "NOT_FOUND"),
            "taxa": self.results
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"✓ Discovery report saved to {report_file}")
        return report_file
    
    def run(self):
        """Execute the full discovery pipeline."""
        print("PhyloPic Asset Discovery Script")
        print("="*60)
        
        # Search all taxa
        for taxon in TERMINAL_TAXA:
            result = self.search_taxon(
                taxon["scientific_name"],
                taxon["common_name"]
            )
            self.results[taxon["scientific_name"]] = result
        
        # Save cache
        self._save_cache()
        
        # Download candidates
        self.download_candidates()
        
        # Generate outputs
        self.generate_json_report()
        self.generate_html_catalog()
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"DISCOVERY COMPLETE")
        print(f"{'='*60}")
        found = sum(1 for r in self.results.values() if r["status"] != "NOT_FOUND")
        print(f"\nResults: {found}/{len(TERMINAL_TAXA)} species")
        print(f"\nOutputs:")
        print(f"  - scripts/phylopic_discovery.json (machine-readable)")
        print(f"  - scripts/phylopic_candidates/ (downloaded SVGs)")
        print(f"  - scripts/phylopic_catalog.html (visual browser)")
        print(f"  - scripts/phylopic_cache.json (API cache)")
        
        # List any not found
        not_found = [r for r in self.results.values() if r["status"] == "NOT_FOUND"]
        if not_found:
            print(f"\nSpecies without suitable images ({len(not_found)}):")
            for r in not_found:
                print(f"  • {r['common_name']} ({r['scientific_name']})")
        
        return found


if __name__ == "__main__":
    discovery = PhyloPicDiscovery()
    count = discovery.run()
    sys.exit(0 if count > 0 else 1)
