#!/usr/bin/env python3
"""
Open Tree of Life Name Resolution Auditor

Verifies candidate species against Open Tree of Life taxonomy using API v3.
Performs name resolution with exact matching first, then approximate matching
for unresolved entries. Preserves all matches and classifies resolution status.

API Documentation: https://github.com/OpenTreeOfLife/germinator/wiki/TNRS-API-v3

Output: Creates phyloexplorer_600_animal_master_list_resolved.csv with full
resolution details and generates a summary report.
"""

import os
import sys
import json
import csv
import time
import logging
from pathlib import Path
from typing import Optional, Dict, List, Any, Tuple
import urllib.parse
import hashlib
from datetime import datetime

try:
    import requests
except ImportError:
    print("ERROR: requests library required. Install with: pip install requests")
    sys.exit(1)

# Configuration
OTL_API_BASE = "https://api.opentreeoflife.org/v3"
TNRS_EXACT_ENDPOINT = "/tnrs/match_names"
TAXONOMY_INFO_ENDPOINT = "/taxonomy/taxon_info"
RATE_LIMIT_DELAY = 0.5  # seconds between API calls
REQUEST_TIMEOUT = 30
MAX_NAMES_PER_REQUEST = 250  # API limit for fuzzy matching
CACHE_DIR = Path("scripts/.ott_cache")
INPUT_CSV = Path("data/phyloexplorer_600_animal_master_list.csv")
OUTPUT_CSV = Path("data/phyloexplorer_600_animal_master_list_resolved.csv")

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scripts/ott_resolution.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class OTLCache:
    """Persistent cache for API responses to avoid unnecessary requests."""
    
    def __init__(self, cache_dir: Path = CACHE_DIR):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.memory_cache = {}
    
    def _get_cache_key(self, query: str, endpoint: str, params: Dict) -> str:
        """Generate stable cache key from query and parameters."""
        key_data = f"{endpoint}:{query}:{json.dumps(params, sort_keys=True)}"
        return hashlib.sha256(key_data.encode()).hexdigest()
    
    def get(self, query: str, endpoint: str, params: Dict) -> Optional[Dict]:
        """Retrieve cached response if available."""
        key = self._get_cache_key(query, endpoint, params)
        
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
    
    def set(self, query: str, endpoint: str, params: Dict, response: Dict) -> None:
        """Cache response to disk and memory."""
        key = self._get_cache_key(query, endpoint, params)
        
        # Store in memory
        self.memory_cache[key] = response
        
        # Store on disk
        cache_file = self.cache_dir / f"{key}.json"
        try:
            with open(cache_file, 'w') as f:
                json.dump(response, f, indent=2)
        except IOError as e:
            logger.warning(f"Failed to write cache file {cache_file}: {e}")


class OTLResolver:
    """Open Tree of Life name resolver with exact and approximate matching."""
    
    def __init__(self):
        self.cache = OTLCache()
        self.last_request_time = 0
    
    def _rate_limit(self) -> None:
        """Enforce rate limiting between API requests."""
        elapsed = time.time() - self.last_request_time
        if elapsed < RATE_LIMIT_DELAY:
            time.sleep(RATE_LIMIT_DELAY - elapsed)
        self.last_request_time = time.time()
    
    def _api_request(self, endpoint: str, data: Dict) -> Dict:
        """Execute API request with caching and error handling."""
        url = OTL_API_BASE + endpoint
        
        # For single-name queries, check cache
        if 'names' in data and len(data['names']) == 1:
            cached = self.cache.get(data['names'][0], endpoint, data)
            if cached is not None:
                logger.debug(f"Cache hit for '{data['names'][0]}'")
                return cached
        
        self._rate_limit()
        
        try:
            logger.debug(f"POST {url} with {len(data.get('names', []))} names")
            response = requests.post(url, json=data, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            result = response.json()
            
            # Cache single-name results
            if 'names' in data and len(data['names']) == 1:
                self.cache.set(data['names'][0], endpoint, data, result)
            
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
    
    def match_names_exact(self, names: List[str]) -> Dict:
        """Match names with exact matching (no fuzzy)."""
        if not names:
            return {'results': []}
        
        data = {
            'names': names,
            'context_name': 'Animals',
            'do_approximate_matching': False
        }
        
        return self._api_request(TNRS_EXACT_ENDPOINT, data)
    
    def match_names_fuzzy(self, names: List[str]) -> Dict:
        """Match names with approximate (fuzzy) matching."""
        if not names:
            return {'results': []}
        
        # API has 250-name limit for fuzzy matching
        if len(names) > MAX_NAMES_PER_REQUEST:
            logger.warning(f"Fuzzy request has {len(names)} names, API limit is {MAX_NAMES_PER_REQUEST}")
        
        data = {
            'names': names[:MAX_NAMES_PER_REQUEST],
            'context_name': 'Animals',
            'do_approximate_matching': True
        }
        
        return self._api_request(TNRS_EXACT_ENDPOINT, data)
    
    def get_taxon_info(self, ott_id: int) -> Dict:
        """Retrieve full taxonomic information for an OTT ID."""
        data = {
            'ott_id': ott_id,
            'include_lineage': True
        }
        
        return self._api_request(TAXONOMY_INFO_ENDPOINT, data)
    
    def classify_match(self, match: Dict, original_name: str) -> Tuple[str, str]:
        """Classify a match result into status category and method.
        
        Returns: (status, method) where
        - status: exact_match, synonym, ambiguous, no_match, higher_rank
        - method: exact, approximate, alternate_search
        """
        # No match at all
        if not match.get('matched_name'):
            return ('no_match', 'none')
        
        matched = match.get('matched_name', '').strip().lower()
        query = original_name.strip().lower()
        
        # Check if this is a higher rank (not species)
        rank = match.get('taxon', {}).get('rank', '').lower()
        if rank and rank not in ['species', 'subspecies']:
            return ('higher_rank', 'exact')
        
        # Exact match
        if matched == query:
            return ('exact_match', 'exact')
        
        # Synonym or other accepted match
        if match.get('is_synonym', False):
            return ('synonym', 'exact')
        
        # Check search_string to determine if approximate/alternate
        search_str = match.get('search_string', '').lower()
        if search_str and search_str != query:
            if 'alternate' in match:
                return ('ambiguous', 'alternate_search')
            else:
                return ('ambiguous', 'approximate')
        
        return ('ambiguous', 'approximate')


class ResolutionAuditor:
    """Audits candidate species against OTL and generates resolution report."""
    
    def __init__(self):
        self.resolver = OTLResolver()
        self.results = []
        self.stats = {
            'total_candidates': 0,
            'exact_matches': 0,
            'synonym_matches': 0,
            'alternate_matches': 0,
            'ambiguous_matches': 0,
            'unmatched': 0,
            'higher_rank_matches': 0,
            'by_collection': {},
            'by_group': {}
        }
    
    def load_candidates(self, csv_path: Path) -> List[Dict]:
        """Load candidate species from CSV with stable row identifiers."""
        candidates = []
        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row_idx, row in enumerate(reader):
                    # Add stable row identifier
                    row['_row_id'] = f"row_{row_idx}"
                    candidates.append(row)
            
            logger.info(f"Loaded {len(candidates)} candidate species")
            self.stats['total_candidates'] = len(candidates)
            return candidates
        
        except FileNotFoundError:
            logger.error(f"CSV not found: {csv_path}")
            sys.exit(1)
        except Exception as e:
            logger.error(f"Failed to load CSV: {e}")
            sys.exit(1)
    
    def resolve_candidate(self, candidate: Dict) -> Dict:
        """Resolve a single candidate against OTL."""
        result = {
            '_row_id': candidate['_row_id'],
            'collection': candidate.get('collection', ''),
            'common_name': candidate.get('common_name', ''),
            'candidate_scientific_name': candidate.get('candidate_scientific_name', ''),
            'alternate_search_names': candidate.get('alternate_search_names', ''),
            'broad_group': candidate.get('broad_group', ''),
            'phylum_candidate': candidate.get('phylum_candidate', ''),
        }
        
        candidate_name = result['candidate_scientific_name'].strip()
        alternate_names = [
            n.strip() for n in result['alternate_search_names'].split(';')
            if n.strip()
        ] if result['alternate_search_names'] else []
        
        # Try exact matching on candidate name
        logger.debug(f"Resolving: {candidate_name}")
        all_matches = []
        matched_query = None
        
        try:
            exact_response = self.resolver.match_names_exact([candidate_name])
            
            # Collect all matches
            for match_result in exact_response.get('results', []):
                for match in match_result.get('matches', []):
                    all_matches.append(match)
                    if not matched_query:
                        matched_query = candidate_name
            
            # If no exact match, try alternate names
            if not all_matches and alternate_names:
                logger.debug(f"No exact match, trying alternates: {alternate_names}")
                alt_response = self.resolver.match_names_exact(alternate_names)
                
                for alt_idx, match_result in enumerate(alt_response.get('results', [])):
                    for match in match_result.get('matches', []):
                        all_matches.append(match)
                        if not matched_query:
                            matched_query = alternate_names[alt_idx]
        
        except Exception as e:
            logger.warning(f"Error matching '{candidate_name}': {e}")
            result['error'] = str(e)
        
        # Classify results
        if all_matches:
            # Sort by confidence
            all_matches.sort(
                key=lambda m: (
                    m.get('score', 0),
                    m.get('taxon', {}).get('rank') == 'species'
                ),
                reverse=True
            )
            
            result['matched_query_name'] = matched_query or candidate_name
            result['num_matches'] = len(all_matches)
            result['all_candidate_matches'] = json.dumps([
                {
                    'name': m.get('matched_name'),
                    'ott_id': m.get('taxon', {}).get('ott_id'),
                    'rank': m.get('taxon', {}).get('rank'),
                    'score': m.get('score'),
                    'is_synonym': m.get('is_synonym')
                }
                for m in all_matches
            ])
            
            # Use best match
            best_match = all_matches[0]
            status, method = self.resolver.classify_match(best_match, matched_query or candidate_name)
            
            result['match_status'] = status
            result['match_method'] = method
            result['accepted_scientific_name'] = best_match.get('matched_name', '')
            
            ott_id = best_match.get('taxon', {}).get('ott_id')
            if ott_id:
                result['ott_id'] = ott_id
                result['ott_rank'] = best_match.get('taxon', {}).get('rank', '')
                result['synonyms'] = json.dumps(best_match.get('taxon', {}).get('synonyms', []))
                result['taxonomy_version'] = best_match.get('taxon', {}).get('sources', [''])[0] if best_match.get('taxon', {}).get('sources') else ''
                
                # Get full lineage
                try:
                    taxon_info = self.resolver.get_taxon_info(ott_id)
                    lineage = taxon_info.get('lineage', [])
                    result['full_lineage'] = json.dumps([
                        {
                            'name': t.get('name'),
                            'rank': t.get('rank'),
                            'ott_id': t.get('ott_id')
                        }
                        for t in lineage
                    ])
                except Exception as e:
                    logger.warning(f"Failed to get lineage for OTT {ott_id}: {e}")
        
        else:
            result['match_status'] = 'no_match'
            result['match_method'] = 'none'
            result['num_matches'] = 0
        
        # Update statistics
        self._update_stats(result, candidate)
        
        return result
    
    def _update_stats(self, result: Dict, original: Dict) -> None:
        """Update resolution statistics."""
        status = result.get('match_status', 'no_match')
        
        if status == 'exact_match':
            self.stats['exact_matches'] += 1
        elif status == 'synonym':
            self.stats['synonym_matches'] += 1
        elif status == 'ambiguous':
            method = result.get('match_method', '')
            if method == 'alternate_search':
                self.stats['alternate_matches'] += 1
            else:
                self.stats['ambiguous_matches'] += 1
        elif status == 'no_match':
            self.stats['unmatched'] += 1
        elif status == 'higher_rank':
            self.stats['higher_rank_matches'] += 1
        
        # Track by collection and group
        collection = result['collection']
        group = result['broad_group']
        
        if collection not in self.stats['by_collection']:
            self.stats['by_collection'][collection] = {
                'total': 0, 'resolved': 0, 'unmatched': 0
            }
        
        self.stats['by_collection'][collection]['total'] += 1
        if status != 'no_match':
            self.stats['by_collection'][collection]['resolved'] += 1
        else:
            self.stats['by_collection'][collection]['unmatched'] += 1
        
        if group not in self.stats['by_group']:
            self.stats['by_group'][group] = {
                'total': 0, 'resolved': 0, 'unmatched': 0
            }
        
        self.stats['by_group'][group]['total'] += 1
        if status != 'no_match':
            self.stats['by_group'][group]['resolved'] += 1
        else:
            self.stats['by_group'][group]['unmatched'] += 1
    
    def save_results(self, results: List[Dict], csv_path: Path) -> None:
        """Save resolution results to CSV."""
        if not results:
            logger.warning("No results to save")
            return
        
        fieldnames = [
            '_row_id',
            'collection',
            'common_name',
            'candidate_scientific_name',
            'alternate_search_names',
            'broad_group',
            'phylum_candidate',
            'matched_query_name',
            'accepted_scientific_name',
            'ott_id',
            'ott_rank',
            'match_status',
            'match_method',
            'num_matches',
            'all_candidate_matches',
            'synonyms',
            'full_lineage',
            'taxonomy_version',
            'error'
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
            "Open Tree of Life Name Resolution Report",
            "=" * 70,
            f"Timestamp: {datetime.now().isoformat()}",
            "",
            "OVERALL STATISTICS",
            "-" * 70,
            f"Total candidates:          {self.stats['total_candidates']}",
            f"Exact matches:             {self.stats['exact_matches']}",
            f"Synonym matches:           {self.stats['synonym_matches']}",
            f"Alternate name matches:    {self.stats['alternate_matches']}",
            f"Ambiguous matches:         {self.stats['ambiguous_matches']}",
            f"Unmatched:                 {self.stats['unmatched']}",
            f"Higher rank matches:       {self.stats['higher_rank_matches']}",
            "",
            "RESULTS BY COLLECTION",
            "-" * 70,
        ]
        
        for collection, stats in sorted(self.stats['by_collection'].items()):
            pct = (stats['resolved'] / stats['total'] * 100) if stats['total'] > 0 else 0
            lines.append(
                f"{collection:30} {stats['total']:4}  "
                f"resolved: {stats['resolved']:4}  "
                f"unmatched: {stats['unmatched']:4}  "
                f"({pct:.1f}%)"
            )
        
        lines.extend([
            "",
            "RESULTS BY GROUP",
            "-" * 70,
        ])
        
        for group, stats in sorted(self.stats['by_group'].items()):
            pct = (stats['resolved'] / stats['total'] * 100) if stats['total'] > 0 else 0
            lines.append(
                f"{group:30} {stats['total']:4}  "
                f"resolved: {stats['resolved']:4}  "
                f"unmatched: {stats['unmatched']:4}  "
                f"({pct:.1f}%)"
            )
        
        lines.extend([
            "",
            "=" * 70,
        ])
        
        return "\n".join(lines)
    
    def audit(self, input_csv: Path = INPUT_CSV, output_csv: Path = OUTPUT_CSV) -> None:
        """Execute full audit workflow."""
        logger.info("Starting Open Tree of Life name resolution audit")
        
        # Load candidates
        candidates = self.load_candidates(input_csv)
        
        # Resolve each candidate
        logger.info(f"Resolving {len(candidates)} candidates...")
        for idx, candidate in enumerate(candidates, 1):
            if idx % 50 == 0:
                logger.info(f"Progress: {idx}/{len(candidates)}")
            
            result = self.resolve_candidate(candidate)
            self.results.append(result)
        
        # Save results
        logger.info(f"Saving results to {output_csv}")
        self.save_results(self.results, output_csv)
        
        # Generate and display report
        report = self.generate_report()
        logger.info("\n" + report)
        
        # Save report
        report_path = Path("scripts/ott_resolution_report.txt")
        with open(report_path, 'w') as f:
            f.write(report)
        logger.info(f"Report saved to {report_path}")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Audit candidate species against Open Tree of Life taxonomy'
    )
    parser.add_argument(
        '-i', '--input',
        type=Path,
        default=INPUT_CSV,
        help=f'Input CSV (default: {INPUT_CSV})'
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
    
    logger.info(f"PhyloExplorer OTL Name Resolver")
    logger.info(f"Input:  {args.input}")
    logger.info(f"Output: {args.output}")
    
    if not args.input.exists():
        logger.error(f"Input file not found: {args.input}")
        sys.exit(1)
    
    auditor = ResolutionAuditor()
    auditor.audit(args.input, args.output)


if __name__ == '__main__':
    main()
