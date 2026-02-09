import os
import urllib.request
import time

# Bounding box for the area in user's screenshot
# Lat: 30.78, Lng: 30.59
# Zoom Level: 19

ZOOM = 19
X_START = 306650
X_END = 306690
Y_START = 215000
Y_END = 215040

BASE_URL = "https://tile.openstreetmap.org"
TARGET_DIR = "map-data/tiles"

def download_tiles():
    headers = {'User-Agent': 'ModernAngularApi/1.0 Agent'}
    for x in range(X_START, X_END + 1):
        x_dir = os.path.join(TARGET_DIR, str(ZOOM), str(x))
        if not os.path.exists(x_dir):
            os.makedirs(x_dir)
            
        for y in range(Y_START, Y_END + 1):
            file_path = os.path.join(x_dir, f"{y}.png")
            if os.path.exists(file_path):
                continue
                
            url = f"{BASE_URL}/{ZOOM}/{x}/{y}.png"
            print(f"Downloading {url} -> {file_path}")
            
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req) as response:
                    if response.status == 200:
                        with open(file_path, 'wb') as f:
                            f.write(response.read())
                        time.sleep(0.05) 
                    else:
                        print(f"Failed to download {url}: {response.status}")
            except Exception as e:
                print(f"Error downloading {url}: {e}")

if __name__ == "__main__":
    download_tiles()
