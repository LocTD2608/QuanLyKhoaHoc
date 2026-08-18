import asyncio
from crawl4ai import AsyncWebCrawler
from pydantic import BaseModel, Field
from typing import List, Optional

class AuthorInfo(BaseModel):
    name: str
    email: Optional[str] = None
    is_corresponding: bool = False
    affiliation: Optional[str] = None

class PaperDetails(BaseModel):
    authors: List[AuthorInfo]

async def crawl_paper(url: str):
    async with AsyncWebCrawler(verbose=True) as crawler:
        # We use a simple crawl first to get markdown content
        result = await crawler.arun(
            url=url,
            bypass_cache=True
        )
        
        if result.success:
            print("Crawl Successful!")
            # Convert to markdown for easier processing by AI later
            return result.markdown
        else:
            print(f"Crawl Failed: {result.error_message}")
            return None

if __name__ == "__main__":
    test_url = "https://www.nature.com/articles/s41586-020-2012-7"
    markdown_content = asyncio.run(crawl_paper(test_url))
    if markdown_content:
        print("Markdown Preview (First 1000 chars):")
        print(markdown_content[:1000])
