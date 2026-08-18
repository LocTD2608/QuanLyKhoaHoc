import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from typing import Optional, Dict

class HeadlessScraper:
    def __init__(self, proxy: Optional[str] = None):
        """
        :param proxy: Proxy format "http://user:pass@host:port"
        """
        self.proxy = proxy

    async def scrape_page(self, url: str) -> Optional[str]:
        """
        Scrape HTML content after JS rendering.
        """
        async with async_playwright() as p:
            # Setting proxy if provided
            launch_args = {}
            if self.proxy:
                launch_args["proxy"] = {"server": self.proxy}

            browser = await p.chromium.launch(headless=True, **launch_args)
            
            # Use a realistic user agent
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
            )
            
            page = await context.new_page()
            
            try:
                # Wait for network idle to ensure data is loaded
                await page.goto(url, wait_until="networkidle", timeout=60000)
                
                # Scroll down to trigger any lazy-loaded content
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight/2)")
                await asyncio.sleep(2) 
                
                content = await page.content()
                return content
            except Exception as e:
                print(f"Error scraping {url}: {str(e)}")
                return None
            finally:
                await browser.close()

    def clean_html(self, html_content: str) -> str:
        """
        Basic cleanup to reduce token size for AI processing later.
        """
        if not html_content:
            return ""
        
        soup = BeautifulSoup(html_content, "html.parser")
        
        # Remove script and style elements
        for script in soup(["script", "style", "header", "footer", "nav"]):
            script.extract()
            
        return soup.get_text(separator="\n", strip=True)

# Test script
if __name__ == "__main__":
    import sys
    
    async def main():
        scraper = HeadlessScraper()
        test_url = "https://www.nature.com/articles/s41586-020-2012-7"
        print(f"Scraping {test_url}...")
        html = await scraper.scrape_page(test_url)
        if html:
            cleaned = scraper.clean_html(html)
            print("Extracted Preview (First 500 chars):")
            print(cleaned[:500])
        else:
            print("Scraping failed.")

    asyncio.run(main())
