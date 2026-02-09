import os
import urllib.request
import time

# Focused bounding box for the user's specific missing area
# Center: 30.78, 30.59 (19/306705/214998)
ZOOM = 19
X_START = 306680
X_END = 306730
Y_START = 214970
Y_END = 215020

BASE_URL = "https://tile.openstreetmap.org"
TARGET_DIR = "map-data/tiles"

def download_tiles():
    headers = {'User-Agent': 'ModernAngularApi/1.0 Agent'}
    count = 0
    for x in range(X_START, X_END + 1):
        x_dir = os.path.join(TARGET_DIR, str(ZOOM), str(x))
        if not os.path.exists(x_dir):
            os.makedirs(x_dir)
            
        for y in range(Y_START, Y_END + 1):
            file_path = os.path.join(x_dir, f"{y}.png")
            if os.path.exists(file_path):
                continue
                
            url = f"{BASE_URL}/{ZOOM}/{x}/{y}.png"
            print(f"[{count}] Downloading {url} -> {file_path}")
            
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req) as response:
                    if response.status == 200:
                        with open(file_path, 'wb') as f:
                            f.write(response.read())
                        count += 1
                        time.sleep(0.04) 
                    else:
                        print(f"Failed {url}: {response.status}")
            except Exception as e:
                print(f"Error {url}: {e}")

if __name__ == "__main__":
    download_tiles()
