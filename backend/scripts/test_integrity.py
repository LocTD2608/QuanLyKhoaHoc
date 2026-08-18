import asyncio
from services.validation_engine.integrity_checker import IntegrityChecker

async def main():
    checker = IntegrityChecker()
    
    # Test 1: Real Predatory Journal
    # From the CSV: Academic Exchange Quarterly
    print("\n--- Test 1: Real Predatory Journal ---")
    res1 = checker.check_journal_integrity("Academic Exchange Quarterly", ["1234-5678"])
    print(f"Result: {res1}")
    
    # Test 2: Fuzzy matching for predatory
    print("\n--- Test 2: Fuzzy Match Predatory ---")
    res2 = checker.check_journal_integrity("Academic Exch Quarterly", ["1234-5678"])
    print(f"Result: {res2}")
    
    # Test 3: Trusted Journal (Scopus/SJR) - Nature
    print("\n--- Test 3: Trusted Journal (Nature) ---")
    res3 = checker.check_journal_integrity("Nature", ["0028-0836"])
    print(f"Result: {res3}")

    # Test 4: Vietnam Standard Journal
    print("\n--- Test 4: Vietnam Standard Journal (TẠP CHÍ CỘNG SẢN) ---")
    res4 = checker.check_journal_integrity("TẠP CHÍ CỘNG SẢN", [])
    print(f"Result: {res4}")
    
    # Test 5: International + Vietnam Standard
    print("\n--- Test 5: Int + VN Standard (VIETNAM JOURNAL OF MATHEMATICS) ---")
    res5 = checker.check_journal_integrity("VIETNAM JOURNAL OF MATHEMATICS", ["2305-2228"])
    print(f"Result: {res5}")

if __name__ == "__main__":
    asyncio.run(main())
