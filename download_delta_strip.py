import os
import urllib.request
import time
import math

# Region: Strip connecting West Area to Tanta
# Lat: 30.75 to 30.85
# Lng: 30.55 to 31.05
# Levels: 15, 16, 17, 18, 19

def deg2num(lat_deg, lon_deg, zoom):
  lat_rad = math.radians(lat_deg)
  n = 2.0 ** zoom
  xtile = int((lon_deg + 180.0) / 360.0 * n)
  ytile = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
  return (xtile, ytile)

BOUNDS = {
    'lat_min': 30.75,
    'lat_max': 30.85,
    'lng_min': 30.55,
    'lng_max': 31.05
}

BASE_URL = "https://tile.openstreetmap.org"
TARGET_DIR = "map-data/tiles"
HEADERS = {'User-Agent': 'ModernAngularApi/1.1 Agent'}

def download_region():
    for zoom in range(15, 20):
        # Calculate tile range for this zoom
        x_min, y_max = deg2num(BOUNDS['lat_min'], BOUNDS['lng_min'], zoom)
        x_max, y_min = deg2num(BOUNDS['lat_max'], BOUNDS['lng_max'], zoom)
        
        # Ensure correct order
        x_start, x_end = min(x_min, x_max), max(x_min, x_max)
        y_start, y_end = min(y_min, y_max), max(y_min, y_max)
        
        print(f"--- Zoom {zoom}: X({x_start}-{x_end}), Y({y_start}-{y_end}) ---")
        
        for x in range(x_start, x_end + 1):
            x_dir = os.path.join(TARGET_DIR, str(zoom), str(x))
            if not os.path.exists(x_dir):
                os.makedirs(x_dir)
                
            for y in range(y_start, y_end + 1):
                file_path = os.path.join(x_dir, f"{y}.png")
                if os.path.exists(file_path):
                    continue
                    
                url = f"{BASE_URL}/{zoom}/{x}/{y}.png"
                try:
                    req = urllib.request.Request(url, headers=HEADERS)
                    with urllib.request.urlopen(req) as response:
                        if response.status == 200:
                            with open(file_path, 'wb') as f:
                                f.write(response.read())
                            # Small delay for levels 15-18, more for 19
                            time.sleep(0.03 if zoom < 19 else 0.06)
                except Exception as e:
                    print(f"Error {url}: {e}")

if __name__ == "__main__":
    download_region()
