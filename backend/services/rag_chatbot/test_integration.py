#!/usr/bin/env python3
"""Quick integration test for scoring_engine bridge."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import scoring_engine

print('=== Test 1: Tra cứu Nature ===')
print(scoring_engine.get_journal_info('NATURE'))
print()

print('=== Test 2: Tính điểm 3 bài ===')
print(scoring_engine.calculate_score([
    {'name': 'NATURE', 'role': 'main'},
    {'name': 'Journal of the Operational Research Society', 'role': 'co-author', 'num_authors': '3'},
    {'name': 'MAGNETIC RESONANCE IN MEDICAL SCIENCES', 'role': 'main'},
]))
