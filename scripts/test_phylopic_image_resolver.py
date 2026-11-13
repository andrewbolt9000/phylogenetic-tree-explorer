#!/usr/bin/env python3
"""
Test suite for PhyloPic Image Resolver

Uses mocked HTTP responses. No live API calls required.
"""

import unittest
from unittest.mock import patch, MagicMock, mock_open
from pathlib import Path
import json
import tempfile
import shutil
import hashlib
from datetime import datetime

# Import the resolver components
from phylopic_image_resolver import (
    PhyloPicCache,
    PhyloPicResolver,
    ImageResolutionAuditor,
    PHYLOPIC_API_BASE,
    PHYLOPIC_RESOLVE_ENDPOINT,
    PHYLOPIC_NODE_ENDPOINT,
    CACHE_DIR
)


class TestPhyloPicCache(unittest.TestCase):
    """Test cache behavior."""
    
    def setUp(self):
        """Create temporary cache directory."""
        self.temp_dir = tempfile.mkdtemp()
        self.cache = PhyloPicCache(self.temp_dir)
    
    def tearDown(self):
        """Clean up temporary files."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_cache_key_generation(self):
        """Verify cache key is stable and deterministic."""
        endpoint = "/resolve/opentreeoflife.org/taxonomy"
        params = {"objectIDs": "123,456"}
        
        key1 = self.cache._get_cache_key(endpoint, params)
        key2 = self.cache._get_cache_key(endpoint, params)
        
        self.assertEqual(key1, key2, "Cache keys should be identical")
        self.assertTrue(key1.startswith("sha256") or len(key1) == 64, "Key should be hex hash")
    
    def test_memory_cache_hit(self):
        """Verify memory cache works."""
        endpoint = "/test"
        params = {"key": "value"}
        data = {"result": "success"}
        
        self.cache.set(endpoint, params, data)
        cached = self.cache.get(endpoint, params)
        
        self.assertEqual(cached, data)
    
    def test_disk_cache_persistence(self):
        """Verify cache persists to disk."""
        endpoint = "/test"
        params = {"key": "value"}
        data = {"result": "persistent"}
        
        self.cache.set(endpoint, params, data)
        
        # Create new cache instance to test disk load
        cache2 = PhyloPicCache(self.temp_dir)
        cached = cache2.get(endpoint, params)
        
        self.assertEqual(cached, data)
    
    def test_cache_miss_returns_none(self):
        """Verify cache miss returns None."""
        endpoint = "/nonexistent"
        params = {"key": "value"}
        
        result = self.cache.get(endpoint, params)
        self.assertIsNone(result)


class TestPhyloPicResolver(unittest.TestCase):
    """Test API resolution and build detection."""
    
    def setUp(self):
        """Create resolver and mock cache."""
        self.temp_dir = tempfile.mkdtemp()
        self.resolver = PhyloPicResolver()
        self.resolver.cache = PhyloPicCache(self.temp_dir)
    
    def tearDown(self):
        """Clean up temporary files."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @patch('phylopic_image_resolver.requests.get')
    def test_build_detection(self, mock_get):
        """Verify build detection from redirect."""
        # Mock redirect response
        mock_response = MagicMock()
        mock_response.status_code = 307
        mock_response.headers = {'Location': 'https://api.phylopic.org/build=562/resolve/...'}
        mock_get.return_value = mock_response
        
        resolver = PhyloPicResolver()
        self.assertEqual(resolver.build, 562)
    
    @patch('phylopic_image_resolver.requests.get')
    def test_resolve_ott_lineage_success(self, mock_get):
        """Verify OTT lineage resolution works."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'uuid': 'node-123',
            '_links': {
                'self': {'href': '/nodes/node-123', 'title': 'Panthera leo'},
                'primaryImage': {'href': '/images/img-456'}
            }
        }
        mock_get.return_value = mock_response
        
        result = self.resolver.resolve_ott_lineage([181460, 125642])
        
        self.assertIn('uuid', result)
        self.assertEqual(result['uuid'], 'node-123')
    
    @patch('phylopic_image_resolver.requests.get')
    def test_resolve_ott_lineage_no_match(self, mock_get):
        """Verify handling of unmatched OTT IDs."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_get.return_value = mock_response
        
        result = self.resolver.resolve_ott_lineage([999999])
        
        self.assertEqual(result, {})
    
    @patch('phylopic_image_resolver.requests.get')
    def test_node_details_with_image(self, mock_get):
        """Verify node details retrieval with primary image."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'uuid': 'node-123',
            'names': [{'name': 'Panthera leo'}],
            '_links': {
                'primaryImage': {'href': '/images/img-456'}
            },
            '_embedded': {
                'primaryImage': {
                    'uuid': 'img-456',
                    'attribution': 'PhyloPic contributor',
                    '_links': {
                        'license': {'href': 'https://creativecommons.org/licenses/by/3.0/'}
                    }
                }
            }
        }
        mock_get.return_value = mock_response
        
        result = self.resolver.get_node_details('node-123')
        
        self.assertIn('_embedded', result)
        self.assertIn('primaryImage', result['_embedded'])


class TestLineageParsing(unittest.TestCase):
    """Test OTT lineage JSON parsing."""
    
    def setUp(self):
        self.auditor = ImageResolutionAuditor()
    
    def test_parse_lineage_json_valid(self):
        """Verify lineage JSON parsing works."""
        lineage_json = json.dumps([
            {'name': 'Mammalia', 'rank': 'class', 'ott_id': 125642},
            {'name': 'Chordata', 'rank': 'phylum', 'ott_id': 125641}
        ])
        
        result = self.auditor.parse_lineage_json(lineage_json)
        
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['ott_id'], 125642)
    
    def test_parse_lineage_json_empty(self):
        """Verify empty lineage returns empty list."""
        result = self.auditor.parse_lineage_json("")
        self.assertEqual(result, [])
        
        result = self.auditor.parse_lineage_json(None)
        self.assertEqual(result, [])
    
    def test_parse_lineage_json_invalid(self):
        """Verify malformed JSON is handled gracefully."""
        result = self.auditor.parse_lineage_json("{invalid json")
        self.assertEqual(result, [])


class TestImageResolutionAuditor(unittest.TestCase):
    """Test full resolution workflow."""
    
    def setUp(self):
        """Create auditor and temp directory."""
        self.temp_dir = tempfile.mkdtemp()
        self.auditor = ImageResolutionAuditor()
    
    def tearDown(self):
        """Clean up temporary files."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_resolve_candidate_with_valid_ott_id(self):
        """Verify resolving a candidate with valid OTT ID."""
        candidate = {
            '_row_id': 'row_0',
            'collection': 'test',
            'common_name': 'Lion',
            'accepted_scientific_name': 'Panthera leo',
            'ott_id': '181460',
            'ott_rank': 'species',
            'match_status': 'exact',
            'full_lineage': json.dumps([
                {'name': 'Mammalia', 'rank': 'class', 'ott_id': 125642}
            ]),
            'broad_group': 'Carnivora'
        }
        
        with patch.object(self.auditor.resolver, 'resolve_ott_lineage') as mock_resolve:
            mock_resolve.return_value = {
                'uuid': 'node-123',
                '_links': {
                    'self': {'title': 'Panthera leo', 'href': '/nodes/node-123'},
                    'primaryImage': {'href': '/images/img-456'}
                }
            }
            
            with patch.object(self.auditor.resolver, 'get_node_details') as mock_details:
                mock_details.return_value = {
                    'uuid': 'node-123',
                    '_links': {'primaryImage': {'href': '/images/img-456'}},
                    '_embedded': {
                        'primaryImage': {
                            'uuid': 'img-456',
                            'attribution': 'Test contributor',
                            '_links': {
                                'license': {'href': 'https://example.com/license'}
                            }
                        }
                    }
                }
                
                result = self.auditor.resolve_candidate_image(candidate)
                
                self.assertEqual(result['phylopic_node_uuid'], 'node-123')
                self.assertEqual(result['phylopic_image_uuid'], 'img-456')
                self.assertEqual(result['phylopic_match_status'], 'image_match')
    
    def test_resolve_candidate_no_ott_id(self):
        """Verify handling of missing OTT ID."""
        candidate = {
            '_row_id': 'row_0',
            'collection': 'test',
            'common_name': 'Unknown',
            'accepted_scientific_name': 'Unknown sp.',
            'ott_id': '',
            'ott_rank': '',
            'match_status': 'no_match',
            'full_lineage': '',
            'broad_group': 'Unknown'
        }
        
        result = self.auditor.resolve_candidate_image(candidate)
        
        self.assertEqual(result['phylopic_match_status'], 'no_ott_id')
        self.assertEqual(result['phylopic_node_uuid'], '')
    
    def test_resolve_candidate_no_match(self):
        """Verify handling of PhyloPic no-match."""
        candidate = {
            '_row_id': 'row_0',
            'collection': 'test',
            'common_name': 'Extinct Species',
            'accepted_scientific_name': 'Extinct species',
            'ott_id': '999999',
            'ott_rank': 'species',
            'match_status': 'exact',
            'full_lineage': '',
            'broad_group': 'Extinct'
        }
        
        with patch.object(self.auditor.resolver, 'resolve_ott_lineage') as mock_resolve:
            mock_resolve.return_value = {}
            
            result = self.auditor.resolve_candidate_image(candidate)
            
            self.assertEqual(result['phylopic_match_status'], 'no_match')
    
    def test_resolve_candidate_node_without_image(self):
        """Verify handling of node without primary image."""
        candidate = {
            '_row_id': 'row_0',
            'collection': 'test',
            'common_name': 'Test Species',
            'accepted_scientific_name': 'Test species',
            'ott_id': '123456',
            'ott_rank': 'species',
            'match_status': 'exact',
            'full_lineage': '',
            'broad_group': 'Test'
        }
        
        with patch.object(self.auditor.resolver, 'resolve_ott_lineage') as mock_resolve:
            mock_resolve.return_value = {
                'uuid': 'node-123',
                '_links': {'self': {'title': 'Test species'}}
            }
            
            with patch.object(self.auditor.resolver, 'get_node_details') as mock_details:
                mock_details.return_value = {
                    '_links': {}
                }
                
                result = self.auditor.resolve_candidate_image(candidate)
                
                self.assertEqual(result['phylopic_match_status'], 'node_without_image')
    
    def test_merge_with_manual_uuid_preservation(self):
        """Verify manual UUIDs are preserved and take precedence."""
        resolved_results = [
            {
                '_row_id': 'row_0',
                'phylopic_image_uuid': 'auto-uuid-123',
                'collection': 'test'
            }
        ]
        
        original_data = {
            'row_0': {
                'manual_phylopic_image_uuid': 'manual-uuid-456'
            }
        }
        
        merged = self.auditor.merge_with_original(resolved_results, original_data)
        
        self.assertEqual(merged[0]['manual_phylopic_image_uuid'], 'manual-uuid-456')
        self.assertEqual(merged[0]['phylopic_image_uuid'], 'auto-uuid-123')
        self.assertEqual(merged[0]['effective_phylopic_image_uuid'], 'manual-uuid-456')
    
    def test_merge_without_manual_uuid(self):
        """Verify automatic UUID is used when no manual UUID."""
        resolved_results = [
            {
                '_row_id': 'row_0',
                'phylopic_image_uuid': 'auto-uuid-123',
                'collection': 'test'
            }
        ]
        
        original_data = {
            'row_0': {
                'manual_phylopic_image_uuid': ''
            }
        }
        
        merged = self.auditor.merge_with_original(resolved_results, original_data)
        
        self.assertEqual(merged[0]['effective_phylopic_image_uuid'], 'auto-uuid-123')


class TestCSVHandling(unittest.TestCase):
    """Test CSV loading and saving."""
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.auditor = ImageResolutionAuditor()
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_load_original_csv(self):
        """Verify original CSV loading."""
        csv_path = Path(self.temp_dir) / "original.csv"
        
        # Create test CSV
        with open(csv_path, 'w') as f:
            f.write("collection,common_name,manual_phylopic_image_uuid\n")
            f.write("test,Lion,uuid-123\n")
            f.write("test,Tiger,\n")
        
        data = self.auditor.load_original_csv(csv_path)
        
        self.assertEqual(len(data), 2)
        self.assertIn('row_0', data)
        self.assertEqual(data['row_0']['common_name'], 'Lion')
    
    def test_save_results(self):
        """Verify results are saved with correct columns."""
        csv_path = Path(self.temp_dir) / "output.csv"
        
        results = [
            {
                '_row_id': 'row_0',
                'collection': 'test',
                'common_name': 'Lion',
                'accepted_scientific_name': 'Panthera leo',
                'ott_id': '181460',
                'phylopic_image_uuid': 'img-123',
                'phylopic_match_status': 'image_match'
            }
        ]
        
        self.auditor.save_results(results, csv_path)
        
        self.assertTrue(csv_path.exists())
        
        # Verify CSV was written
        with open(csv_path, 'r') as f:
            lines = f.readlines()
            self.assertGreater(len(lines), 1)
            self.assertIn('phylopic_image_uuid', lines[0])


class TestStatisticsTracking(unittest.TestCase):
    """Test statistics collection."""
    
    def setUp(self):
        self.auditor = ImageResolutionAuditor()
    
    def test_update_stats_image_match(self):
        """Verify image match statistics are recorded."""
        result = {
            'collection': 'well_known',
            'phylopic_match_status': 'image_match',
            'phylopic_matched_node_rank': 'species'
        }
        
        original = {
            'broad_group': 'Carnivora'
        }
        
        self.auditor._update_stats(result, original)
        
        self.assertEqual(self.auditor.stats['by_collection']['well_known']['image_match'], 1)
        self.assertEqual(self.auditor.stats['by_group']['Carnivora']['image_match'], 1)
    
    def test_update_stats_no_match(self):
        """Verify no-match statistics are recorded."""
        result = {
            'collection': 'well_known',
            'phylopic_match_status': 'no_match',
            'phylopic_matched_node_rank': ''
        }
        
        original = {
            'broad_group': 'Carnivora'
        }
        
        self.auditor._update_stats(result, original)
        
        self.assertEqual(self.auditor.stats['by_collection']['well_known']['no_match'], 1)


if __name__ == '__main__':
    unittest.main()
