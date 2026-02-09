import math
import os

def deg2num(lat_deg, lon_deg, zoom):
  lat_rad = math.radians(lat_deg)
  n = 2.0 ** zoom
  xtile = int((lon_deg + 180.0) / 360.0 * n)
  ytile = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
  return (xtile, ytile)

# User location from screenshot
lat, lng = 30.775872, 30.597655
zoom = 19

x, y = deg2num(lat, lng, zoom)
print(f"Target Tile: {zoom}/{x}/{y}")

path = f"map-data/tiles/{zoom}/{x}/{y}.png"
if os.path.exists(path):
    print(f"FILE EXISTS: {path}")
else:
    print(f"FILE MISSING: {path}")

# Check surrounding 3x3
print("\nChecking 3x3 grid:")
for dx in range(-1, 2):
    for dy in range(-1, 2):
        px, py = x + dx, y + dy
        ppath = f"map-data/tiles/{zoom}/{px}/{py}.png"
        status = "EXISTS" if os.path.exists(ppath) else "MISSING"
        print(f"Tile {zoom}/{px}/{py}: {status}")
