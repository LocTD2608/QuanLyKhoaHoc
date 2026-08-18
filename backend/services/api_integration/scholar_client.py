import os
import re
import urllib.parse
import requests
from typing import List, Optional, Dict, Any

class ScholarClient:
    def __init__(self):
        self.serpapi_key = os.getenv("SERPAPI_KEY", "")
        self.headers = {
            "User-Agent": "ScientificManagementSystem/2.0 (mailto:dungdq@vn.edu.vn)"
        }

    def parse_scholar_input(self, input_str: str) -> Dict[str, str]:
        """
        Parses an input string (full URL, search query, or raw ID)
        and detects the source and clean ID.
        """
        raw = input_str.strip()
        if not raw:
            return {"id": "", "source": "auto", "type": "empty"}

        # 1. Google Scholar URL (e.g. https://scholar.google.com/citations?user=AbCdEfG123...)
        if "scholar.google." in raw or "citations?user=" in raw:
            match = re.search(r"user=([a-zA-Z0-9_\-]+)", raw)
            if match:
                return {"id": match.group(1), "source": "google_scholar", "type": "id"}

        # 2. OpenAlex URL or ID (e.g. https://openalex.org/A5012345678 or A5012345678)
        if "openalex.org/" in raw or re.match(r"^A\d{8,12}$", raw, re.IGNORECASE):
            clean_id = raw.split("/")[-1].strip()
            return {"id": clean_id.upper(), "source": "openalex", "type": "id"}

        # 3. Semantic Scholar URL or ID (e.g. https://www.semanticscholar.org/author/name/12345 or raw digits)
        if "semanticscholar.org/author" in raw:
            clean_id = raw.rstrip("/").split("/")[-1]
            return {"id": clean_id, "source": "semantic_scholar", "type": "id"}

        # 4. ORCID URL or format (e.g. 0000-0002-1825-0097)
        if "orcid.org/" in raw or re.match(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$", raw):
            clean_orcid = raw.split("/")[-1].strip()
            return {"id": clean_orcid, "source": "openalex", "type": "orcid"}

        # 5. Raw numeric ID (typically Semantic Scholar)
        if raw.isdigit() and len(raw) >= 6:
            return {"id": raw, "source": "semantic_scholar", "type": "id"}

        # 6. Alphanumeric 12-char Scholar ID (e.g. 4v-N_u0AAAAJ)
        if re.match(r"^[a-zA-Z0-9_\-]{10,16}$", raw):
            return {"id": raw, "source": "google_scholar", "type": "id"}

        # Otherwise treat as query
        return {"id": raw, "source": "auto", "type": "query"}

    def get_author_profile(self, scholar_id_or_url: str, source: str = "auto") -> Optional[Dict[str, Any]]:
        """
        Fetch enriched author profile and publications from the best available source.
        """
        parsed = self.parse_scholar_input(scholar_id_or_url)
        target_id = parsed["id"] if parsed["id"] else scholar_id_or_url
        effective_source = parsed["source"] if source == "auto" else source

        # If it's OpenAlex or ORCID
        if effective_source == "openalex" or target_id.startswith("A") or target_id.startswith("https://openalex.org") or parsed["type"] == "orcid":
            profile = self.get_author_profile_openalex(target_id)
            if profile:
                return profile

        # If Google Scholar via SerpApi
        if effective_source == "google_scholar" or (effective_source == "auto" and self.serpapi_key):
            if self.serpapi_key:
                profile = self.get_author_profile_serpapi(target_id)
                if profile:
                    return profile
            # Fallback to Semantic Scholar or OpenAlex
            s2_profile = self.get_author_profile_semantic_scholar(target_id)
            if s2_profile:
                return s2_profile
            return self.get_author_profile_openalex(target_id)

        # Semantic Scholar
        if effective_source == "semantic_scholar":
            profile = self.get_author_profile_semantic_scholar(target_id)
            if profile:
                return profile
            return self.get_author_profile_openalex(target_id)

        # General auto fallback
        profile = self.get_author_profile_openalex(target_id)
        if not profile:
            profile = self.get_author_profile_semantic_scholar(target_id)
        return profile

    def get_author_profile_openalex(self, author_id_or_orcid: str) -> Optional[Dict[str, Any]]:
        """
        Fetch rich author profile and publications from OpenAlex (Free, No API Key required).
        """
        try:
            clean_id = author_id_or_orcid.split("/")[-1].strip()
            
            # Determine API URL based on ID format or ORCID
            if re.match(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$", clean_id):
                url = f"https://api.openalex.org/authors/https://orcid.org/{clean_id}"
            elif clean_id.upper().startswith("A"):
                url = f"https://api.openalex.org/authors/{clean_id.upper()}"
            else:
                url = f"https://api.openalex.org/authors/{clean_id}"

            resp = requests.get(url, headers=self.headers, timeout=12)
            if resp.status_code != 200:
                # If direct lookup fails, try searching by query
                search_url = "https://api.openalex.org/authors"
                search_resp = requests.get(search_url, params={"search": clean_id, "per-page": 1}, headers=self.headers, timeout=10)
                if search_resp.status_code == 200:
                    results = search_resp.json().get("results", [])
                    if results:
                        author_data = results[0]
                    else:
                        return None
                else:
                    return None
            else:
                author_data = resp.json()

            if not author_data:
                return None

            openalex_author_id = author_data.get("id", "").split("/")[-1]
            display_name = author_data.get("display_name") or ""
            
            # Extract affiliations
            affiliations = []
            for inst in author_data.get("affiliations", []):
                inst_obj = inst.get("institution", {})
                if inst_obj and inst_obj.get("display_name"):
                    affiliations.append(inst_obj.get("display_name"))
            if not affiliations and author_data.get("last_known_institutions"):
                for inst in author_data.get("last_known_institutions", []):
                    if inst.get("display_name"):
                        affiliations.append(inst.get("display_name"))

            affiliation = ", ".join(affiliations[:2]) if affiliations else ""

            # Metrics
            summary_stats = author_data.get("summary_stats") or {}
            citations = author_data.get("cited_by_count") or summary_stats.get("cited_by_count", 0)
            h_index = summary_stats.get("h_index") or 0
            i10_index = summary_stats.get("i10_index") or 0

            # Yearly citations history
            yearly_citations = []
            for count_item in author_data.get("counts_by_year", []):
                year = count_item.get("year")
                c_count = count_item.get("cited_by_count", 0)
                w_count = count_item.get("works_count", 0)
                if year and year >= 2015:
                    yearly_citations.append({
                        "year": year,
                        "citations": c_count,
                        "works": w_count
                    })
            yearly_citations.sort(key=lambda x: x["year"])

            # Research topics / concepts
            topics = []
            for concept in author_data.get("x_concepts", []):
                if concept.get("display_name") and concept.get("score", 0) > 0.3:
                    topics.append({
                        "name": concept.get("display_name"),
                        "score": round(concept.get("score", 0), 2)
                    })
            topics = topics[:8]

            # Fetch works list (up to 50 works)
            works_url = "https://api.openalex.org/works"
            works_params = {
                "filter": f"author.id:{openalex_author_id}",
                "sort": "publication_year:desc,cited_by_count:desc",
                "per-page": 50
            }
            works_resp = requests.get(works_url, params=works_params, headers=self.headers, timeout=15)
            papers = []
            co_authors_dict = {}

            if works_resp.status_code == 200:
                works_data = works_resp.json().get("results", [])
                for work in works_data:
                    title = work.get("title") or "Untitled"
                    year = work.get("publication_year") or 0
                    work_citations = work.get("cited_by_count") or 0
                    doi = (work.get("doi") or "").replace("https://doi.org/", "")

                    # Venue & ISSN
                    primary_loc = work.get("primary_location") or {}
                    source_obj = primary_loc.get("source") or {}
                    journal_name = source_obj.get("display_name") or ""
                    issn_list = source_obj.get("issn") or []
                    issn = issn_list[0] if issn_list else ""

                    # Authorships
                    authors = []
                    candidate_position = "member"
                    for idx, a_ship in enumerate(work.get("authorships", [])):
                        author_obj = a_ship.get("author") or {}
                        a_name = author_obj.get("display_name") or ""
                        if a_name:
                            authors.append(a_name)
                            if a_name != display_name:
                                co_authors_dict[a_name] = co_authors_dict.get(a_name, 0) + 1

                        if author_obj.get("id", "").endswith(openalex_author_id):
                            pos = a_ship.get("author_position")
                            if pos == "first" or idx == 0:
                                candidate_position = "main"
                            elif a_ship.get("is_corresponding"):
                                candidate_position = "corresponding"

                    papers.append({
                        "title": title,
                        "journal_name": journal_name,
                        "issn": issn,
                        "doi": doi,
                        "year": year,
                        "citations": work_citations,
                        "authors": authors,
                        "num_authors": len(authors) if authors else 1,
                        "candidate_position": candidate_position
                    })

            # Top co-authors
            co_authors = [
                {"name": name, "shared_papers": count}
                for name, count in sorted(co_authors_dict.items(), key=lambda x: x[1], reverse=True)[:6]
            ]

            return {
                "scholar_id": openalex_author_id,
                "name": display_name,
                "affiliation": affiliation,
                "citations": citations,
                "h_index": h_index,
                "i10_index": i10_index,
                "yearly_citations": yearly_citations,
                "topics": topics,
                "co_authors": co_authors,
                "papers": papers,
                "source": "openalex"
            }

        except Exception as e:
            print(f"[!] OpenAlex Profile Error: {e}")
            return None

    def get_author_profile_semantic_scholar(self, scholar_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch author profile from Semantic Scholar.
        """
        try:
            url = f"https://api.semanticscholar.org/graph/v1/author/{scholar_id}"
            fields = "name,affiliations,homepage,paperCount,citationCount,hIndex,papers.title,papers.year,papers.externalIds,papers.authors,papers.venue,papers.publicationVenue,papers.citationCount"
            response = requests.get(url, params={"fields": fields}, timeout=15)
            
            if response.status_code != 200:
                print(f"[!] Semantic Scholar API returned status {response.status_code} for ID {scholar_id}")
                return None
                
            data = response.json()
            if not data:
                return None

            raw_papers = data.get("papers", []) or []
            i10_index = sum(1 for p in raw_papers if (p.get("citationCount") or 0) >= 10)

            papers = []
            yearly_map = {}
            co_authors_dict = {}
            author_name = data.get("name") or ""

            for p in raw_papers:
                external_ids = p.get("externalIds") or {}
                doi = external_ids.get("DOI") or ""
                
                journal_name = p.get("venue") or ""
                pub_venue = p.get("publicationVenue") or {}
                if pub_venue and pub_venue.get("name"):
                    journal_name = pub_venue.get("name")
                
                issn_list = []
                if pub_venue:
                    if pub_venue.get("issn"):
                        issn_list.append(pub_venue.get("issn"))
                    if pub_venue.get("alternate_issns"):
                        issn_list.extend(pub_venue.get("alternate_issns"))

                authors = [a.get("name") for a in p.get("authors", []) if a.get("name")]
                year = p.get("year") or 0
                citations = p.get("citationCount") or 0

                if year >= 2015:
                    if year not in yearly_map:
                        yearly_map[year] = {"year": year, "citations": 0, "works": 0}
                    yearly_map[year]["works"] += 1

                for auth in authors:
                    if auth != author_name:
                        co_authors_dict[auth] = co_authors_dict.get(auth, 0) + 1

                papers.append({
                    "title": p.get("title") or "Untitled",
                    "journal_name": journal_name,
                    "issn": issn_list[0] if issn_list else "",
                    "doi": doi,
                    "year": year,
                    "citations": citations,
                    "authors": authors,
                    "num_authors": len(authors) if authors else 1
                })

            papers.sort(key=lambda x: x["citations"], reverse=True)
            affiliations = data.get("affiliations") or []
            affiliation = affiliations[0] if affiliations else ""

            yearly_citations = sorted(yearly_map.values(), key=lambda x: x["year"])
            co_authors = [
                {"name": name, "shared_papers": count}
                for name, count in sorted(co_authors_dict.items(), key=lambda x: x[1], reverse=True)[:6]
            ]

            return {
                "scholar_id": scholar_id,
                "name": author_name,
                "affiliation": affiliation,
                "citations": data.get("citationCount") or 0,
                "h_index": data.get("hIndex") or 0,
                "i10_index": i10_index,
                "yearly_citations": yearly_citations,
                "topics": [],
                "co_authors": co_authors,
                "papers": papers,
                "source": "semantic_scholar"
            }
        except Exception as e:
            print(f"[!] Semantic Scholar Error: {e}")
            return None

    def get_author_profile_serpapi(self, scholar_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch author profile from Google Scholar using SerpApi.
        """
        try:
            url = "https://serpapi.com/search.json"
            params = {
                "engine": "google_scholar_author",
                "author_id": scholar_id,
                "api_key": self.serpapi_key
            }
            response = requests.get(url, params=params, timeout=15)
            if response.status_code != 200:
                return None
                
            data = response.json()
            if "error" in data:
                return None

            author_info = data.get("author", {})
            cited_by = data.get("cited_by", {})
            
            citations_stats = cited_by.get("table", [])
            citations = 0
            h_index = 0
            i10_index = 0

            if isinstance(citations_stats, list):
                for row in citations_stats:
                    for key, val in row.items():
                        all_val = val.get("all", 0) if isinstance(val, dict) else 0
                        if key == "citations":
                            citations = all_val
                        elif key == "h_index":
                            h_index = all_val
                        elif key == "i10_index":
                            i10_index = all_val
            elif isinstance(citations_stats, dict):
                citations = citations_stats.get("citations", {}).get("all", 0)
                h_index = citations_stats.get("h_index", {}).get("all", 0)
                i10_index = citations_stats.get("i10_index", {}).get("all", 0)

            # Yearly graph if available in SerpApi
            yearly_citations = []
            graph = cited_by.get("graph", [])
            if isinstance(graph, list):
                for item in graph:
                    y = item.get("year")
                    c = item.get("citations", 0)
                    if y and str(y).isdigit():
                        yearly_citations.append({"year": int(y), "citations": int(c), "works": 0})

            # Topics / interests
            interests = author_info.get("interests", [])
            topics = [{"name": it.get("title", ""), "score": 1.0} for it in interests if isinstance(it, dict) and it.get("title")]

            raw_articles = data.get("articles", []) or []
            papers = []
            co_authors_dict = {}

            for art in raw_articles:
                authors_str = art.get("authors") or ""
                authors = [a.strip() for a in authors_str.split(",") if a.strip()]

                for a in authors:
                    if a != author_info.get("name"):
                        co_authors_dict[a] = co_authors_dict.get(a, 0) + 1

                papers.append({
                    "title": art.get("title") or "Untitled",
                    "journal_name": art.get("publication") or "",
                    "issn": "",
                    "doi": "",
                    "year": int(art.get("year")) if art.get("year") and str(art.get("year")).isdigit() else 0,
                    "citations": art.get("cited_by", {}).get("value", 0) or 0,
                    "authors": authors,
                    "num_authors": len(authors) if authors else 1
                })

            papers.sort(key=lambda x: x["citations"], reverse=True)
            co_authors = [
                {"name": name, "shared_papers": count}
                for name, count in sorted(co_authors_dict.items(), key=lambda x: x[1], reverse=True)[:6]
            ]

            return {
                "scholar_id": scholar_id,
                "name": author_info.get("name") or "",
                "affiliation": author_info.get("affiliations") or "",
                "citations": citations,
                "h_index": h_index,
                "i10_index": i10_index,
                "yearly_citations": yearly_citations,
                "topics": topics,
                "co_authors": co_authors,
                "papers": papers,
                "source": "google_scholar"
            }
        except Exception as e:
            print(f"[!] SerpApi Error: {e}")
            return None

    def search_authors(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for authors across OpenAlex and Semantic Scholar by name or affiliation.
        """
        results = []
        seen_ids = set()

        # 1. Search OpenAlex (Free, highly accurate)
        try:
            url = "https://api.openalex.org/authors"
            params = {
                "search": query,
                "per-page": 8
            }
            resp = requests.get(url, params=params, headers=self.headers, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                for author in data.get("results", []):
                    aid = author.get("id", "").split("/")[-1]
                    if not aid or aid in seen_ids:
                        continue
                    seen_ids.add(aid)

                    affs = []
                    for inst in author.get("affiliations", []):
                        inst_name = inst.get("institution", {}).get("display_name")
                        if inst_name:
                            affs.append(inst_name)
                    if not affs and author.get("last_known_institutions"):
                        for inst in author.get("last_known_institutions", []):
                            if inst.get("display_name"):
                                affs.append(inst.get("display_name"))

                    summary = author.get("summary_stats") or {}
                    topics = [c.get("display_name") for c in author.get("x_concepts", [])[:3] if c.get("display_name")]

                    results.append({
                        "scholar_id": aid,
                        "name": author.get("display_name") or "",
                        "affiliation": ", ".join(affs[:2]) if affs else "Chưa cập nhật đơn vị",
                        "paper_count": author.get("works_count") or 0,
                        "citations": author.get("cited_by_count") or summary.get("cited_by_count", 0),
                        "h_index": summary.get("h_index") or 0,
                        "i10_index": summary.get("i10_index") or 0,
                        "topics": topics,
                        "source": "openalex"
                    })
        except Exception as e:
            print(f"[!] OpenAlex author search error: {e}")

        # 2. Search Semantic Scholar (Backup)
        if len(results) < 5:
            try:
                url = "https://api.semanticscholar.org/graph/v1/author/search"
                params = {
                    "query": query,
                    "fields": "name,affiliations,paperCount,citationCount,hIndex",
                    "limit": 5
                }
                resp = requests.get(url, params=params, timeout=6)
                if resp.status_code == 200:
                    data = resp.json()
                    for author in data.get("data", []):
                        aid = str(author.get("authorId"))
                        if not aid or aid in seen_ids:
                            continue
                        seen_ids.add(aid)

                        affs = author.get("affiliations") or []
                        results.append({
                            "scholar_id": aid,
                            "name": author.get("name") or "",
                            "affiliation": affs[0] if affs else "Chưa cập nhật đơn vị",
                            "paper_count": author.get("paperCount") or 0,
                            "citations": author.get("citationCount") or 0,
                            "h_index": author.get("hIndex") or 0,
                            "topics": [],
                            "source": "semantic_scholar"
                        })
            except Exception as e:
                print(f"[!] Semantic Scholar author search error: {e}")

        return results

    def resolve_paper_metadata(self, title: str, journal_name: str = "") -> Optional[Dict[str, Any]]:
        """
        Attempt to resolve DOI, ISSN, and verified venue from OpenAlex by paper title.
        """
        try:
            url = "https://api.openalex.org/works"
            params = {
                "search": title,
                "per-page": 2
            }
            response = requests.get(url, params=params, headers=self.headers, timeout=8)
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                if not results:
                    return None

                best_match = results[0]
                doi = best_match.get("doi", "").replace("https://doi.org/", "")
                primary_location = best_match.get("primary_location", {}) or {}
                source = primary_location.get("source", {}) or {}
                
                issns = source.get("issn", []) or []
                resolved_journal = source.get("display_name") or journal_name
                year = best_match.get("publication_year")

                authors = []
                for authorship in best_match.get("authorships", []):
                    raw_name = authorship.get("author", {}).get("display_name", "")
                    if raw_name:
                        authors.append(raw_name)

                return {
                    "doi": doi,
                    "issn": issns[0] if issns else "",
                    "journal_name": resolved_journal,
                    "year": year,
                    "authors": authors
                }
            return None
        except Exception as e:
            print(f"[!] Error resolving paper metadata for {title}: {e}")
            return None
