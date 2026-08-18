import requests
import os
import csv

PREDATORY_JOURNALS_URL = "https://raw.githubusercontent.com/stop-predatory-journals/stop-predatory-journals.github.io/master/_data/journals.csv"
PREDATORY_PUBLISHERS_URL = "https://raw.githubusercontent.com/stop-predatory-journals/stop-predatory-journals.github.io/master/_data/publishers.csv"

DATA_DIR = "data"

def download_file(url, filename):
    print(f"Downloading {url}...")
    response = requests.get(url)
    if response.status_code == 200:
        path = os.path.join(DATA_DIR, filename)
        with open(path, "wb") as f:
            f.write(response.content)
        print(f"Saved to {path}")
        return True
    else:
        print(f"Failed to download {url} (Status: {response.status_code})")
        return False

def main():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    # Predatory Journals
    download_file(PREDATORY_JOURNALS_URL, "predatory_journals.csv")
    download_file(PREDATORY_PUBLISHERS_URL, "predatory_publishers.csv")

    print("\n--- Manual Step Required for SJR Rankings ---")
    print("SCImago (SJR) does not provide a stable direct download link for the latest year.")
    print("Please visit: https://www.scimagojr.com/journalrank.php")
    print("1. Click 'Download data' (top right)")
    print("2. Save the file as 'data/scimagojr_2023.csv' (or the latest year)")
    print("---------------------------------------------\n")

if __name__ == "__main__":
    main()
