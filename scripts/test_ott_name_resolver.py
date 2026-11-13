"""
Unit tests for Open Tree of Life Name Resolver

Tests cover CSV parsing, API integration, caching, match classification,
and output generation.
"""

import pytest
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import csv

# Import the resolver module
import sys
sys.path.insert(0, str(Path(__file__).parent))
from ott_name_resolver import (
    OTLCache,
    OTLResolver,
    ResolutionAuditor
)


class TestOTLCache:
    """Test caching behavior."""
    
    def test_cache_initialization(self):
        """Cache directory is created on initialization."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = OTLCache(Path(tmpdir) / 'cache')
            assert cache.cache_dir.exists()
    
    def test_cache_key_generation(self):
        """Same query+endpoint+params produces same key."""
        cache = OTLCache()
        
        key1 = cache._get_cache_key('Panthera leo', '/tnrs/match_names', {'exact': True})
        key2 = cache._get_cache_key('Panthera leo', '/tnrs/match_names', {'exact': True})
        
        assert key1 == key2
        assert len(key1) == 64  # SHA256 hex is 64 chars
    
    def test_cache_key_different_for_different_queries(self):
        """Different queries produce different keys."""
        cache = OTLCache()
        
        key1 = cache._get_cache_key('Panthera leo', '/tnrs/match_names', {'exact': True})
        key2 = cache._get_cache_key('Panthera tigris', '/tnrs/match_names', {'exact': True})
        
        assert key1 != key2
    
    def test_memory_cache_get_set(self):
        """Data stored in memory cache is retrievable."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = OTLCache(Path(tmpdir))
            data = {'result': 'test'}
            
            cache.set('test_query', '/endpoint', {}, data)
            result = cache.get('test_query', '/endpoint', {})
            
            assert result == data
    
    def test_disk_cache_persistence(self):
        """Data persists to disk and is loaded correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = Path(tmpdir)
            
            # Write data
            cache1 = OTLCache(cache_path)
            data = {'result': 'persisted_data'}
            cache1.set('test_query', '/endpoint', {}, data)
            
            # Clear memory cache
            cache1.memory_cache.clear()
            
            # Load from disk
            result = cache1.get('test_query', '/endpoint', {})
            assert result == data
    
    def test_cache_miss_returns_none(self):
        """Cache miss returns None."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = OTLCache(Path(tmpdir))
            result = cache.get('nonexistent', '/endpoint', {})
            assert result is None


class TestOTLResolver:
    """Test OTL resolver functionality."""
    
    @patch('ott_name_resolver.requests.post')
    def test_exact_match_request(self, mock_post):
        """match_names_exact sends correct API request."""
        mock_response = Mock()
        mock_response.json.return_value = {'results': []}
        mock_post.return_value = mock_response
        
        resolver = OTLResolver()
        # Use multiple names to bypass cache logic
        resolver.match_names_exact(['Panthera leo', 'Panthera tigris'])
        
        # Verify the request
        assert mock_post.called
        call_args = mock_post.call_args
        assert call_args[1]['json']['do_approximate_matching'] is False
        assert call_args[1]['json']['context_name'] == 'Animals'
        assert 'Panthera leo' in call_args[1]['json']['names']
    
    @patch('ott_name_resolver.requests.post')
    def test_fuzzy_match_request(self, mock_post):
        """match_names_fuzzy sends correct API request."""
        mock_response = Mock()
        mock_response.json.return_value = {'results': []}
        mock_post.return_value = mock_response
        
        resolver = OTLResolver()
        # Use multiple names to bypass cache logic
        resolver.match_names_fuzzy(['Panthera leo', 'Panthera tigris'])
        
        # Verify the request
        assert mock_post.called
        call_args = mock_post.call_args
        assert call_args[1]['json']['do_approximate_matching'] is True
    
    @patch('ott_name_resolver.requests.post')
    def test_classify_match_exact(self, mock_post):
        """Classify exact matches correctly."""
        resolver = OTLResolver()
        
        match = {
            'matched_name': 'Panthera leo',
            'taxon': {'rank': 'species'}
        }
        
        status, method = resolver.classify_match(match, 'Panthera leo')
        assert status == 'exact_match'
        assert method == 'exact'
    
    def test_classify_match_synonym(self):
        """Classify synonym matches correctly."""
        resolver = OTLResolver()
        
        match = {
            'matched_name': 'Leo leo',
            'is_synonym': True,
            'taxon': {'rank': 'species'}
        }
        
        status, method = resolver.classify_match(match, 'Panthera leo')
        assert status == 'synonym'
    
    def test_classify_match_higher_rank(self):
        """Classify higher rank matches correctly."""
        resolver = OTLResolver()
        
        match = {
            'matched_name': 'Panthera',
            'taxon': {'rank': 'genus'}
        }
        
        status, method = resolver.classify_match(match, 'Panthera leo')
        assert status == 'higher_rank'
    
    def test_classify_match_no_match(self):
        """Classify no-match correctly."""
        resolver = OTLResolver()
        
        match = {
            'matched_name': None,
            'taxon': {}
        }
        
        status, method = resolver.classify_match(match, 'Panthera leo')
        assert status == 'no_match'


class TestResolutionAuditor:
    """Test auditor functionality."""
    
    def test_csv_loading(self):
        """Load CSV with row identifiers."""
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / 'test.csv'
            
            # Create test CSV
            with open(csv_path, 'w', newline='') as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=['collection', 'common_name', 'candidate_scientific_name', 'alternate_search_names', 'broad_group', 'phylum_candidate']
                )
                writer.writeheader()
                writer.writerow({
                    'collection': 'test',
                    'common_name': 'Lion',
                    'candidate_scientific_name': 'Panthera leo',
                    'alternate_search_names': 'African lion',
                    'broad_group': 'Mammalia',
                    'phylum_candidate': ''
                })
            
            auditor = ResolutionAuditor()
            candidates = auditor.load_candidates(csv_path)
            
            assert len(candidates) == 1
            assert candidates[0]['_row_id'] == 'row_0'
            assert candidates[0]['candidate_scientific_name'] == 'Panthera leo'
    
    def test_csv_loading_empty_file(self):
        """Handle empty CSV gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / 'empty.csv'
            
            with open(csv_path, 'w', newline='') as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=['collection', 'common_name', 'candidate_scientific_name', 'alternate_search_names', 'broad_group', 'phylum_candidate']
                )
                writer.writeheader()
            
            auditor = ResolutionAuditor()
            candidates = auditor.load_candidates(csv_path)
            
            assert len(candidates) == 0
    
    def test_csv_loading_missing_file(self):
        """Fail gracefully for missing file."""
        auditor = ResolutionAuditor()
        
        with pytest.raises(SystemExit):
            auditor.load_candidates(Path('/nonexistent/file.csv'))
    
    @patch.object(OTLResolver, 'match_names_exact')
    def test_resolve_candidate_exact_match(self, mock_match):
        """Resolve candidate with exact match."""
        mock_match.return_value = {
            'results': [{
                'matches': [{
                    'matched_name': 'Panthera leo',
                    'is_synonym': False,
                    'score': 1.0,
                    'taxon': {
                        'ott_id': 541927,
                        'rank': 'species',
                        'synonyms': []
                    }
                }]
            }]
        }
        
        auditor = ResolutionAuditor()
        candidate = {
            '_row_id': 'row_0',
            'collection': 'test',
            'common_name': 'Lion',
            'candidate_scientific_name': 'Panthera leo',
            'alternate_search_names': '',
            'broad_group': 'Mammalia',
            'phylum_candidate': ''
        }
        
        result = auditor.resolve_candidate(candidate)
        
        assert result['match_status'] == 'exact_match'
        assert result['accepted_scientific_name'] == 'Panthera leo'
        assert result['ott_id'] == 541927
    
    @patch.object(OTLResolver, 'match_names_exact')
    def test_resolve_candidate_no_match(self, mock_match):
        """Resolve candidate with no match."""
        mock_match.return_value = {'results': [{'matches': []}]}
        
        auditor = ResolutionAuditor()
        candidate = {
            '_row_id': 'row_0',
            'collection': 'test',
            'common_name': 'UnknownAnimal',
            'candidate_scientific_name': 'Unknownus fictitius',
            'alternate_search_names': '',
            'broad_group': 'Unknown',
            'phylum_candidate': ''
        }
        
        result = auditor.resolve_candidate(candidate)
        
        assert result['match_status'] == 'no_match'
        assert result['num_matches'] == 0
    
    def test_stats_tracking(self):
        """Stats are tracked correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = ResolutionAuditor()
            
            # Manually add to stats
            result = {'match_status': 'exact_match', 'collection': 'test', 'broad_group': 'Mammalia'}
            original = {}
            auditor._update_stats(result, original)
            
            assert auditor.stats['exact_matches'] == 1
            assert auditor.stats['by_collection']['test']['total'] == 1
            assert auditor.stats['by_collection']['test']['resolved'] == 1
    
    def test_save_results(self):
        """Results are saved to CSV correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'results.csv'
            auditor = ResolutionAuditor()
            
            results = [
                {
                    '_row_id': 'row_0',
                    'collection': 'test',
                    'common_name': 'Lion',
                    'candidate_scientific_name': 'Panthera leo',
                    'match_status': 'exact_match',
                    'accepted_scientific_name': 'Panthera leo',
                    'ott_id': 541927
                }
            ]
            
            auditor.save_results(results, output_path)
            
            assert output_path.exists()
            
            # Verify content
            with open(output_path, 'r') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            
            assert len(rows) == 1
            assert rows[0]['candidate_scientific_name'] == 'Panthera leo'
            assert rows[0]['match_status'] == 'exact_match'
    
    def test_report_generation(self):
        """Report is generated with correct statistics."""
        auditor = ResolutionAuditor()
        auditor.stats['total_candidates'] = 10
        auditor.stats['exact_matches'] = 8
        auditor.stats['unmatched'] = 2
        auditor.stats['by_collection']['test'] = {'total': 10, 'resolved': 8, 'unmatched': 2}
        
        report = auditor.generate_report()
        
        assert '10' in report  # total
        assert 'exact matches' in report.lower()
        assert 'test' in report
        assert '=' * 70 in report


class TestIntegration:
    """Integration tests."""
    
    def test_full_workflow_mock(self):
        """Full audit workflow with mocked API."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            
            # Create input CSV
            input_path = tmpdir / 'candidates.csv'
            with open(input_path, 'w', newline='') as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=['collection', 'common_name', 'candidate_scientific_name', 'alternate_search_names', 'broad_group', 'phylum_candidate']
                )
                writer.writeheader()
                writer.writerow({
                    'collection': 'test_collection',
                    'common_name': 'Lion',
                    'candidate_scientific_name': 'Panthera leo',
                    'alternate_search_names': '',
                    'broad_group': 'Carnivora',
                    'phylum_candidate': ''
                })
                writer.writerow({
                    'collection': 'test_collection',
                    'common_name': 'Tiger',
                    'candidate_scientific_name': 'Panthera tigris',
                    'alternate_search_names': 'Bengal tiger',
                    'broad_group': 'Carnivora',
                    'phylum_candidate': ''
                })
            
            output_path = tmpdir / 'results.csv'
            
            # Mock the resolver
            with patch.object(OTLResolver, 'match_names_exact') as mock_match:
                mock_match.side_effect = [
                    {
                        'results': [{
                            'matches': [{
                                'matched_name': 'Panthera leo',
                                'is_synonym': False,
                                'score': 1.0,
                                'taxon': {'ott_id': 541927, 'rank': 'species', 'synonyms': []}
                            }]
                        }]
                    },
                    {
                        'results': [{
                            'matches': [{
                                'matched_name': 'Panthera tigris',
                                'is_synonym': False,
                                'score': 1.0,
                                'taxon': {'ott_id': 541928, 'rank': 'species', 'synonyms': []}
                            }]
                        }]
                    }
                ]
                
                auditor = ResolutionAuditor()
                auditor.audit(input_path, output_path)
            
            # Verify results
            assert output_path.exists()
            
            with open(output_path, 'r') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            
            assert len(rows) == 2
            assert rows[0]['accepted_scientific_name'] == 'Panthera leo'
            assert rows[1]['accepted_scientific_name'] == 'Panthera tigris'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
