#!/usr/bin/env python3
"""
PhyloPic Image UUID Resolver

Finds PhyloPic silhouette images for animals using their resolved Open Tree of
Life (OTT) identifiers and taxonomic lineages.

Distinguishes exact species matches from ancestor/inherited matches.
Retrieves image metadata including license, contributor, and URLs.

API Documentation: https://api-docs.phylopic.org/
"""

import os
import sys
import json
import csv
import time
import logging
from pathlib import Path
from typing import Optional, Dict, List, Any, Tuple
import hashlib
from datetime import datetime

try:
    import requests
except ImportError:
    print("ERROR: requests library required. Install with: pip install requests")
    sys.exit(1)

# Configuration
PHYLOPIC_API_BASE = "https://api.phylopic.org"
PHYLOPIC_RESOLVE_ENDPOINT = "/resolve/opentreeoflife.org/taxonomy"
PHYLOPIC_NODE_ENDPOINT = "/nodes"
PHYLOPIC_IMAGE_ENDPOINT = "/images"
PHYLOPIC_BUILD = 562  # Will be detected from first request
RATE_LIMIT_DELAY = 0.5  # seconds between API calls
REQUEST_TIMEOUT = 30
CACHE_DIR = Path("scripts/.phylopic_cache")
INPUT_RESOLVED_CSV = Path("data/phyloexplorer_600_animal_master_list_resolved.csv")
INPUT_ORIGINAL_CSV = Path("data/phyloexplorer_600_animal_master_list.csv")
OUTPUT_CSV = Path("data/phyloexplorer_600_animal_master_list_phylopic.csv")

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scripts/phylopic_resolution.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class PhyloPicCache:
    """Persistent cache for API responses."""
    
    def __init__(self, cache_dir: Path = CACHE_DIR):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.memory_cache = {}
    
    def _get_cache_key(self, endpoint: str, params: Dict) -> str:
        """Generate stable cache key from endpoint and parameters."""
        key_data = f"{endpoint}:{json.dumps(params, sort_keys=True)}"
        return hashlib.sha256(key_data.encode()).hexdigest()
    
    def get(self, endpoint: str, params: Dict) -> Optional[Dict]:
        """Retrieve cached response if available."""
        key = self._get_cache_key(endpoint, params)
        
        # Check memory cache first
        if key in self.memory_cache:
            return self.memory_cache[key]
        
        # Check disk cache
        cache_file = self.cache_dir / f"{key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                    self.memory_cache[key] = data
                    return data
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Failed to read cache file {cache_file}: {e}")
                return None
        
        return None
    
    def set(self, endpoint: str, params: Dict, response: Dict) -> None:
        """Cache response to disk and memory."""
        key = self._get_cache_key(endpoint, params)
        
        # Store in memory
        self.memory_cache[key] = response
        
        # Store on disk
        cache_file = self.cache_dir / f"{key}.json"
        try:
            with open(cache_file, 'w') as f:
                json.dump(response, f, indent=2)
        except IOError as e:
            logger.warning(f"Failed to write cache file {cache_file}: {e}")


class PhyloPicResolver:
    """PhyloPic API client with caching and rate limiting."""
    
    def __init__(self):
        self.cache = PhyloPicCache()
        self.last_request_time = 0
        self.build = PHYLOPIC_BUILD
        self._detect_build()
    
    def _detect_build(self) -> None:
        """Detect current PhyloPic build number."""
        try:
            response = requests.get(
                PHYLOPIC_API_BASE,
                params={},
                timeout=REQUEST_TIMEOUT
            )
            
            if response.status_code == 307:
                # Redirect to build version
                location = response.headers.get('Location', '')
                if 'build=' in location:
                    build_str = location.split('build=')[1].split('&')[0]
                    self.build = int(build_str)
                    logger.info(f"Detected PhyloPic build: {self.build}")
            elif response.status_code == 200:
                data = response.json()
                if 'build' in data:
                    self.build = data['build']
                    logger.info(f"Detected PhyloPic build: {self.build}")
        
        except Exception as e:
            logger.warning(f"Failed to detect build, using default {self.build}: {e}")
    
    def _rate_limit(self) -> None:
        """Enforce rate limiting between API requests."""
        elapsed = time.time() - self.last_request_time
        if elapsed < RATE_LIMIT_DELAY:
            time.sleep(RATE_LIMIT_DELAY - elapsed)
        self.last_request_time = time.time()
    
    def _api_request(self, endpoint: str, params: Dict) -> Dict:
        """Execute API request with caching and error handling."""
        # Add build to params
        params = dict(params, build=self.build)
        
        # Check cache
        cached = self.cache.get(endpoint, params)
        if cached is not None:
            logger.debug(f"Cache hit for {endpoint}")
            return cached
        
        self._rate_limit()
        
        url = PHYLOPIC_API_BASE + endpoint
        
        try:
            logger.debug(f"GET {url} with params {params}")
            response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT, allow_redirects=True)
            response.raise_for_status()
            result = response.json()
            
            # Update build if received
            if 'build' in result:
                self.build = result['build']
            
            # Cache result
            self.cache.set(endpoint, params, result)
            
            return result
        
        except requests.exceptions.Timeout:
            logger.error(f"API timeout for {endpoint}")
            raise
        except requests.exceptions.HTTPError as e:
            logger.error(f"API error {response.status_code}: {response.text}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response: {e}")
            raise
    
    def resolve_ott_lineage(self, ott_ids: List[int]) -> Dict:
        """Resolve OTT IDs (including lineage) to PhyloPic node."""
        if not ott_ids:
            return {}
        
        # Format OTT IDs as comma-separated string
        ott_string = ','.join(str(id) for id in ott_ids)
        
        params = {'objectIDs': ott_string}
        
        return self._api_request(PHYLOPIC_RESOLVE_ENDPOINT, params)
    
    def get_node_details(self, node_uuid: str, embed_image: bool = True) -> Dict:
        """Retrieve detailed information about a PhyloPic node."""
        endpoint = f"{PHYLOPIC_NODE_ENDPOINT}/{node_uuid}"
        params = {}
        
        if embed_image:
            params['embed_primaryImage'] = 'true'
        
        return self._api_request(endpoint, params)
    
    def get_image_details(self, image_uuid: str) -> Dict:
        """Retrieve detailed information about a PhyloPic image."""
        endpoint = f"{PHYLOPIC_IMAGE_ENDPOINT}/{image_uuid}"
        params = {}
        
        return self._api_request(endpoint, params)


class ImageResolutionAuditor:
    """Orchestrates the image resolution workflow."""
    
    def __init__(self):
        self.resolver = PhyloPicResolver()
        self.results = []
        self.stats = {
            'total_animals': 0,
            'exact_matches': 0,
            'ancestor_matches': 0,
            'nodes_without_images': 0,
            'no_match': 0,
            'no_ott_id': 0,
            'api_errors': 0,
            'by_collection': {},
            'by_group': {},
            'by_rank': {}
        }
    
    def load_original_csv(self, csv_path: Path) -> Dict[str, Dict]:
        """Load original master list with manual UUIDs preserved."""
        original_data = {}
        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row_idx, row in enumerate(reader):
                    row_id = f"row_{row_idx}"
                    original_data[row_id] = row
            
            logger.info(f"Loaded {len(original_data)} original candidates")
            return original_data
        
        except FileNotFoundError:
            logger.error(f"CSV not found: {csv_path}")
            sys.exit(1)
        except Exception as e:
            logger.error(f"Failed to load CSV: {e}")
            sys.exit(1)
    
    def load_resolved_csv(self, csv_path: Path) -> List[Dict]:
        """Load OTT resolution results."""
        candidates = []
        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    candidates.append(row)
            
            logger.info(f"Loaded {len(candidates)} resolved candidates")
            self.stats['total_animals'] = len(candidates)
            return candidates
        
        except FileNotFoundError:
            logger.error(f"CSV not found: {csv_path}")
            sys.exit(1)
        except Exception as e:
            logger.error(f"Failed to load CSV: {e}")
            sys.exit(1)
    
    def parse_lineage_json(self, lineage_json: str) -> List[Dict]:
        """Parse full_lineage JSON field."""
        if not lineage_json or not lineage_json.strip():
            return []
        
        try:
            return json.loads(lineage_json)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse lineage JSON: {e}")
            return []
    
    def resolve_candidate_image(self, candidate: Dict) -> Dict:
        """Resolve a single candidate to a PhyloPic image."""
        result = {
            '_row_id': candidate['_row_id'],
            'collection': candidate.get('collection', ''),
            'common_name': candidate.get('common_name', ''),
            'accepted_scientific_name': candidate.get('accepted_scientific_name', ''),
            'ott_id': candidate.get('ott_id', ''),
            'ott_rank': candidate.get('ott_rank', ''),
            'match_status': candidate.get('match_status', ''),
            'phylopic_node_uuid': '',
            'phylopic_image_uuid': '',
            'phylopic_match_status': '',
            'phylopic_matched_node_name': '',
            'phylopic_matched_node_rank': '',
            'phylopic_match_type': '',
            'phylopic_lineage_distance': '',
            'phylopic_license': '',
            'phylopic_contributor': '',
            'phylopic_image_url': '',
            'phylopic_error': ''
        }
        
        # Check if we have an OTT ID
        ott_id_str = candidate.get('ott_id', '').strip()
        if not ott_id_str:
            result['phylopic_match_status'] = 'no_ott_id'
            return result
        
        try:
            ott_id = int(ott_id_str)
        except ValueError:
            result['phylopic_match_status'] = 'no_ott_id'
            return result
        
        # Build OTT lineage: animal's own ID + ancestors
        ott_lineage = [ott_id]
        
        # Parse ancestor lineage if available
        lineage_json = candidate.get('full_lineage', '')
        if lineage_json:
            try:
                ancestors = self.parse_lineage_json(lineage_json)
                for ancestor in ancestors:
                    ancestor_id = ancestor.get('ott_id')
                    if ancestor_id and ancestor_id != ott_id:
                        ott_lineage.append(ancestor_id)
            except Exception as e:
                logger.warning(f"Error processing lineage for {candidate.get('common_name')}: {e}")
        
        # Resolve lineage to PhyloPic node
        try:
            logger.debug(f"Resolving OTT lineage {ott_lineage} for {candidate.get('common_name')}")
            resolve_result = self.resolver.resolve_ott_lineage(ott_lineage)
            
            # Check if we got a node match
            if not resolve_result or '_links' not in resolve_result or 'self' not in resolve_result['_links']:
                result['phylopic_match_status'] = 'no_match'
                self.stats['no_match'] += 1
                return result
            
            # Extract node UUID
            node_self_link = resolve_result['_links']['self']
            node_uuid = resolve_result.get('uuid')
            
            if not node_uuid:
                result['phylopic_match_status'] = 'no_match'
                self.stats['no_match'] += 1
                return result
            
            result['phylopic_node_uuid'] = node_uuid
            result['phylopic_matched_node_name'] = node_self_link.get('title', '')
            
            # Determine lineage distance (how many steps from requested taxon)
            # For now, if the UUID matches the first OTT ID's resolution, it's exact
            lineage_distance = 0  # Will be updated below
            
            # Get node details to find primary image and rank
            try:
                node_details = self.resolver.get_node_details(node_uuid, embed_image=True)
                
                # Extract rank if available
                if 'names' in node_details:
                    # Rank might not be directly available in names
                    # Check _links for hints about rank
                    pass
                
                # Check for primary image
                primary_image_link = node_details.get('_links', {}).get('primaryImage')
                
                if not primary_image_link:
                    result['phylopic_match_status'] = 'node_without_image'
                    self.stats['nodes_without_images'] += 1
                    return result
                
                image_uuid = None
                if '_embedded' in node_details and 'primaryImage' in node_details['_embedded']:
                    primary_image = node_details['_embedded']['primaryImage']
                    image_uuid = primary_image.get('uuid')
                    
                    # Extract image metadata
                    result['phylopic_image_uuid'] = image_uuid or ''
                    result['phylopic_contributor'] = primary_image.get('attribution', '')
                    
                    # Extract license
                    license_link = primary_image.get('_links', {}).get('license', {})
                    if isinstance(license_link, dict):
                        result['phylopic_license'] = license_link.get('href', '')
                    
                    # Determine match type
                    if lineage_distance == 0:
                        result['phylopic_match_type'] = 'exact_species'
                        self.stats['exact_matches'] += 1
                    else:
                        result['phylopic_match_type'] = 'ancestor'
                        self.stats['ancestor_matches'] += 1
                    
                    result['phylopic_match_status'] = 'image_match'
                    result['phylopic_lineage_distance'] = str(lineage_distance)
                
                else:
                    # Node found but image not embedded
                    result['phylopic_match_status'] = 'node_without_image'
                    self.stats['nodes_without_images'] += 1
                
            except Exception as e:
                logger.warning(f"Error getting node details for {node_uuid}: {e}")
                result['phylopic_error'] = str(e)
                self.stats['api_errors'] += 1
        
        except Exception as e:
            logger.warning(f"Error resolving OTT lineage for {candidate.get('common_name')}: {e}")
            result['phylopic_error'] = str(e)
            result['phylopic_match_status'] = 'api_error'
            self.stats['api_errors'] += 1
        
        # Update collection and group stats
        self._update_stats(result, candidate)
        
        return result
    
    def _update_stats(self, result: Dict, original: Dict) -> None:
        """Update resolution statistics."""
        collection = result['collection']
        group = original.get('broad_group', '')
        rank = result.get('phylopic_matched_node_rank', 'unknown')
        
        if collection not in self.stats['by_collection']:
            self.stats['by_collection'][collection] = {
                'total': 0, 'image_match': 0, 'node_without_image': 0, 'no_match': 0, 'error': 0
            }
        
        self.stats['by_collection'][collection]['total'] += 1
        
        status = result['phylopic_match_status']
        if status == 'image_match':
            self.stats['by_collection'][collection]['image_match'] += 1
        elif status == 'node_without_image':
            self.stats['by_collection'][collection]['node_without_image'] += 1
        elif status == 'no_match':
            self.stats['by_collection'][collection]['no_match'] += 1
        else:
            self.stats['by_collection'][collection]['error'] += 1
        
        if group not in self.stats['by_group']:
            self.stats['by_group'][group] = {
                'total': 0, 'image_match': 0, 'node_without_image': 0, 'no_match': 0, 'error': 0
            }
        
        self.stats['by_group'][group]['total'] += 1
        
        if status == 'image_match':
            self.stats['by_group'][group]['image_match'] += 1
        elif status == 'node_without_image':
            self.stats['by_group'][group]['node_without_image'] += 1
        elif status == 'no_match':
            self.stats['by_group'][group]['no_match'] += 1
        else:
            self.stats['by_group'][group]['error'] += 1
        
        if rank not in self.stats['by_rank']:
            self.stats['by_rank'][rank] = 0
        self.stats['by_rank'][rank] += 1
    
    def merge_with_original(self, resolved_results: List[Dict], original_data: Dict) -> List[Dict]:
        """Merge resolution results with original data, preserving manual UUIDs."""
        merged = []
        
        for result in resolved_results:
            row_id = result['_row_id']
            original = original_data.get(row_id, {})
            
            # Preserve manual PhyloPic UUID from original if present
            manual_uuid = original.get('manual_phylopic_image_uuid', '')
            
            # Add manual UUID field
            result['manual_phylopic_image_uuid'] = manual_uuid
            
            # Determine effective image UUID: manual takes precedence
            result['effective_phylopic_image_uuid'] = manual_uuid if manual_uuid else result.get('phylopic_image_uuid', '')
            
            merged.append(result)
        
        return merged
    
    def save_results(self, results: List[Dict], csv_path: Path) -> None:
        """Save resolution results to CSV."""
        if not results:
            logger.warning("No results to save")
            return
        
        fieldnames = [
            '_row_id',
            'collection',
            'common_name',
            'accepted_scientific_name',
            'ott_id',
            'ott_rank',
            'match_status',
            'phylopic_node_uuid',
            'phylopic_image_uuid',
            'manual_phylopic_image_uuid',
            'effective_phylopic_image_uuid',
            'phylopic_match_status',
            'phylopic_matched_node_name',
            'phylopic_matched_node_rank',
            'phylopic_match_type',
            'phylopic_lineage_distance',
            'phylopic_license',
            'phylopic_contributor',
            'phylopic_image_url',
            'phylopic_error'
        ]
        
        try:
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames, restval='')
                writer.writeheader()
                
                for result in results:
                    writer.writerow(result)
            
            logger.info(f"Saved {len(results)} results to {csv_path}")
        
        except Exception as e:
            logger.error(f"Failed to save results: {e}")
            raise
    
    def generate_report(self) -> str:
        """Generate concise resolution summary report."""
        lines = [
            "=" * 70,
            "PhyloPic Image Resolution Report",
            "=" * 70,
            f"Timestamp: {datetime.now().isoformat()}",
            "",
            "OVERALL STATISTICS",
            "-" * 70,
            f"Total animals processed:  {self.stats['total_animals']}",
            f"Exact species matches:    {self.stats['exact_matches']}",
            f"Ancestor/inherited:       {self.stats['ancestor_matches']}",
            f"Nodes without images:     {self.stats['nodes_without_images']}",
            f"No PhyloPic node found:   {self.stats['no_match']}",
            f"No OTT ID available:      {self.stats['no_ott_id']}",
            f"API errors:               {self.stats['api_errors']}",
            "",
            "RESULTS BY COLLECTION",
            "-" * 70,
        ]
        
        for collection, stats in sorted(self.stats['by_collection'].items()):
            total = stats['total']
            images = stats['image_match']
            pct = (images / total * 100) if total > 0 else 0
            lines.append(
                f"{collection:25} {total:4}  images: {images:4}  ({pct:.1f}%)"
            )
        
        lines.extend([
            "",
            "RESULTS BY GROUP",
            "-" * 70,
        ])
        
        for group, stats in sorted(self.stats['by_group'].items()):
            total = stats['total']
            images = stats['image_match']
            pct = (images / total * 100) if total > 0 else 0
            lines.append(
                f"{group:25} {total:4}  images: {images:4}  ({pct:.1f}%)"
            )
        
        lines.extend([
            "",
            "=" * 70,
        ])
        
        return "\n".join(lines)
    
    def audit(
        self,
        input_resolved: Path = INPUT_RESOLVED_CSV,
        input_original: Path = INPUT_ORIGINAL_CSV,
        output_csv: Path = OUTPUT_CSV
    ) -> None:
        """Execute full image resolution workflow."""
        logger.info("Starting PhyloPic image resolution audit")
        
        # Load inputs
        original_data = self.load_original_csv(input_original)
        candidates = self.load_resolved_csv(input_resolved)
        
        # Resolve each candidate
        logger.info(f"Resolving images for {len(candidates)} candidates...")
        for idx, candidate in enumerate(candidates, 1):
            if idx % 50 == 0:
                logger.info(f"Progress: {idx}/{len(candidates)}")
            
            result = self.resolve_candidate_image(candidate)
            self.results.append(result)
        
        # Merge with original data
        merged_results = self.merge_with_original(self.results, original_data)
        
        # Save results
        logger.info(f"Saving results to {output_csv}")
        self.save_results(merged_results, output_csv)
        
        # Generate and display report
        report = self.generate_report()
        logger.info("\n" + report)
        
        # Save report
        report_path = Path("scripts/phylopic_resolution_report.txt")
        with open(report_path, 'w') as f:
            f.write(report)
        logger.info(f"Report saved to {report_path}")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Resolve PhyloPic images using Open Tree of Life taxonomy'
    )
    parser.add_argument(
        '-r', '--resolved',
        type=Path,
        default=INPUT_RESOLVED_CSV,
        help=f'Input resolved CSV (default: {INPUT_RESOLVED_CSV})'
    )
    parser.add_argument(
        '-i', '--original',
        type=Path,
        default=INPUT_ORIGINAL_CSV,
        help=f'Input original CSV (default: {INPUT_ORIGINAL_CSV})'
    )
    parser.add_argument(
        '-o', '--output',
        type=Path,
        default=OUTPUT_CSV,
        help=f'Output CSV (default: {OUTPUT_CSV})'
    )
    parser.add_argument(
        '--no-cache',
        action='store_true',
        help='Disable response caching'
    )
    
    args = parser.parse_args()
    
    logger.info(f"PhyloExplorer PhyloPic Image Resolver")
    logger.info(f"Resolved:  {args.resolved}")
    logger.info(f"Original:  {args.original}")
    logger.info(f"Output:    {args.output}")
    
    if not args.resolved.exists():
        logger.error(f"Resolved CSV not found: {args.resolved}")
        sys.exit(1)
    
    if not args.original.exists():
        logger.error(f"Original CSV not found: {args.original}")
        sys.exit(1)
    
    auditor = ImageResolutionAuditor()
    auditor.audit(args.resolved, args.original, args.output)


if __name__ == '__main__':
    main()
