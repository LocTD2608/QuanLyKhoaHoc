import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import scoring_engine

print("=== Testing Specific Journals ===")
journals = [
    ("Journal of the Operational Research Society", "0160-5682"),
    ("Knowledge and Management of Aquatic Ecosystems", "1961-9502")
]

for name, issn in journals:
    print(f"\n--- Testing: {name} ---")
    info = scoring_engine.get_journal_info(name, issn)
    print(info)
    
    score = scoring_engine.calculate_score([{"name": name, "issn": issn, "role": "main", "num_authors": 1}])
    print("\nCalculation Result:")
    print(score)
