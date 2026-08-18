import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_endpoints():
    # Login first
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("Testing /api/teams...")
    # List teams
    res = client.get("/api/teams", headers=headers)
    assert res.status_code == 200, f"Teams list failed: {res.text}"
    teams = res.json()
    print(f"-> Found {len(teams)} teams:")
    for t in teams:
        papers = t.get("papers", [])
        collabs = [p for p in papers if p.get("is_collaborative")]
        print(f"   Team '{t['name']}': {len(t.get('members', []))} members, {len(papers)} papers ({len(collabs)} collaborative), Achieved this year: {t.get('achieved')}/{t.get('kpi_papers_per_year')}")

    print("\nTesting /api/authors...")
    res = client.get("/api/authors", headers=headers)
    assert res.status_code == 200, f"Authors list failed: {res.text}"
    authors = res.json()
    print(f"-> Found {len(authors)} authors:")
    for a in authors:
        print(f"   Author '{a['name']}': {len(a.get('teams', []))} teams, {a.get('papers_count')} papers, {len(a.get('top_coauthors', []))} co-authors")

    print("\nALL BACKEND TESTS PASSED!")

if __name__ == "__main__":
    test_endpoints()
