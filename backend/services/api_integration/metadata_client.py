import requests
from typing import List, Optional, Dict
from .schemas import Author, JournalMetadata, ArticleMetadata

class OpenAlexClient:
    API_URL = "https://api.openalex.org/sources"

    def fetch_work_by_doi(self, doi: str) -> Optional[Dict]:
        """
        Fetch work/article metadata from OpenAlex by DOI.
        """
        try:
            headers = {
                "User-Agent": "ScientificManagementSystem/1.0 (mailto:dungdq@vn.edu)"
            }
            clean_doi = doi.strip()
            if clean_doi.startswith("https://doi.org/"):
                clean_doi = clean_doi.replace("https://doi.org/", "")
            
            url = f"https://api.openalex.org/works/https://doi.org/{clean_doi}"
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                params = {"filter": f"doi:https://doi.org/{clean_doi}"}
                response = requests.get("https://api.openalex.org/works", params=params, headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("results"):
                        return data["results"][0]
            return None
        except Exception as e:
            print(f"OpenAlex Error (DOI {doi}): {e}")
            return None

    def fetch_source_by_issn(self, issn: str) -> Optional[JournalMetadata]:
        """
        Fetch journal metadata from OpenAlex by ISSN.
        """
        try:
            params = {"filter": f"issn:{issn}"}
            response = requests.get(self.API_URL, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("results"):
                    source = data["results"][0]
                    return JournalMetadata(
                        id=source.get("id"),
                        display_name=source.get("display_name"),
                        issn=source.get("issn", []),
                        issn_l=source.get("issn_l"),
                        is_oa=source.get("is_oa", False),
                        is_in_doaj=source.get("is_in_doaj", False),
                        publisher=source.get("host_organization_name"),
                        homepage_url=source.get("homepage_url"),
                        cited_by_count=source.get("cited_by_count", 0),
                        works_count=source.get("works_count", 0),
                        h_index=source.get("summary_stats", {}).get("h_index"),
                        country_code=source.get("country_code"),
                        type=source.get("type")
                    )
            return None
        except Exception as e:
            print(f"OpenAlex Error (ISSN {issn}): {e}")
            return None

    def search_source_by_name(self, name: str) -> List[JournalMetadata]:
        """
        Search for journals in OpenAlex by name.
        """
        try:
            params = {"search": name}
            response = requests.get(self.API_URL, params=params, timeout=10)
            results = []
            if response.status_code == 200:
                data = response.json()
                for source in data.get("results", []):
                    results.append(JournalMetadata(
                        id=source.get("id"),
                        display_name=source.get("display_name"),
                        issn=source.get("issn", []),
                        issn_l=source.get("issn_l"),
                        is_oa=source.get("is_oa", False),
                        is_in_doaj=source.get("is_in_doaj", False),
                        publisher=source.get("host_organization_name"),
                        homepage_url=source.get("homepage_url"),
                        cited_by_count=source.get("cited_by_count", 0),
                        works_count=source.get("works_count", 0),
                        h_index=source.get("summary_stats", {}).get("h_index"),
                        country_code=source.get("country_code"),
                        type=source.get("type")
                    ))
            return results
        except Exception as e:
            print(f"OpenAlex Error (Name {name}): {e}")
            return []

class DOAJClient:
    API_URL = "https://doaj.org/api/v2/search/journals/"

    def is_journal_in_doaj(self, issn: str) -> bool:
        """
        Check if a journal is indexed in DOAJ by ISSN.
        """
        try:
            response = requests.get(f"{self.API_URL}{issn}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get("total", 0) > 0
            return False
        except Exception as e:
            print(f"DOAJ Error (ISSN {issn}): {e}")
            return False

class MetadataClient:
    CROSSREF_API_URL = "https://api.crossref.org/works/"

    def __init__(self):
        self.openalex = OpenAlexClient()
        self.doaj = DOAJClient()

    def _parse_openalex_work(self, data: dict, original_doi: str) -> ArticleMetadata:
        title = data.get("title") or ""
        primary_location = data.get("primary_location", {}) or {}
        source = primary_location.get("source", {}) or {}
        journal = source.get("display_name") or ""
        issns = source.get("issn", []) or []
        
        authors = []
        for authorship in data.get("authorships", []):
            raw_name = authorship.get("raw_author_name") or authorship.get("author", {}).get("display_name", "")
            parts = raw_name.split()
            if len(parts) > 1:
                given = " ".join(parts[:-1])
                family = parts[-1]
            else:
                given = ""
                family = raw_name
                
            authors.append(Author(
                given=given,
                family=family,
                sequence="first" if authorship.get("author_position") == "first" else "additional",
                affiliation=authorship.get("raw_affiliation_strings", []) or [],
                is_corresponding=authorship.get("is_corresponding", False)
            ))
            
        year = data.get("publication_year")
        biblio = data.get("biblio", {}) or {}
        volume = biblio.get("volume")
        issue = biblio.get("issue")
        first_page = biblio.get("first_page")
        last_page = biblio.get("last_page")
        pages = f"{first_page}-{last_page}" if first_page and last_page else (first_page or last_page)
        
        return ArticleMetadata(
            title=title,
            journal=journal,
            authors=authors,
            year=year,
            doi=data.get("doi", "").replace("https://doi.org/", "") or original_doi,
            volume=volume,
            issue=issue,
            pages=pages,
            issn=issns
        )

    def fetch_metadata(self, doi: str, include_expanded: bool = True) -> Optional[ArticleMetadata]:
        """
        Fetch metadata from OpenAlex API based on DOI.
        """
        try:
            print(f"[*] Querying OpenAlex works API for DOI: {doi}...")
            oa_work = self.openalex.fetch_work_by_doi(doi)
            if not oa_work:
                print(f"OpenAlex work not found for DOI {doi}")
                return None
            
            article = self._parse_openalex_work(oa_work, doi)
            
            if article and include_expanded and article.issn:
                try:
                    journal_meta = self.openalex.fetch_source_by_issn(article.issn[0])
                    if not journal_meta and len(article.issn) > 1:
                        journal_meta = self.openalex.fetch_source_by_issn(article.issn[1])
                    if journal_meta:
                        article.journal_metadata = journal_meta
                except Exception as e:
                    print(f"Error enriching journal metadata: {e}")
            return article
        except Exception as e:
            print(f"Error fetching metadata for DOI {doi}: {e}")
            return None

    def fetch_from_crossref(self, doi: str, include_expanded: bool = True) -> Optional[ArticleMetadata]:
        """
        Fetch metadata from OpenAlex based on DOI (Crossref is bypassed/deprecated).
        """
        return self.fetch_metadata(doi, include_expanded)

# Simple manual test block
if __name__ == "__main__":
    client = MetadataClient()
    test_doi = "10.1038/s41586-020-2012-7" # SARS-CoV-2 paper example
    meta = client.fetch_from_crossref(test_doi)
    if meta:
        print(meta.model_dump_json(indent=4))
    else:
        print("Failed to fetch metadata.")
