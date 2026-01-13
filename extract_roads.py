import os
from pyrosm import OSM

# Path to your downloaded PBF file
pbf_path = r"src/assets/egypt-260106.osm.pbf"
output_path = r"src/assets/egypt-roads-extracted.geojson"

if not os.path.exists(pbf_path):
    print(f"Error: File not found at {pbf_path}")
    exit(1)

print("Initializing OSM parser...")
osm = OSM(pbf_path)

# Filter for driving network (highways)
# network_type="driving" captures motorway, trunk, primary, secondary, tertiary, etc.
print("Extracting road network (this may take a few minutes)...")
roads = osm.get_network(network_type="driving")

if roads is not None:
    print(f"Extracted {len(roads)} road segments.")
    
    # Optional: Filter for even smaller file (e.g. only major roads)
    # major_roads = roads[roads['highway'].isin(['motorway', 'trunk', 'primary'])]
    
    print(f"Saving to GeoJSON: {output_path}")
    # Exporting as GeoJSON
    roads.to_file(output_path, driver='GeoJSON')
    print("Optimization Tip: If the file is too large, consider filtering for major roads only or a specific bounding box.")
else:
    print("No roads found or error during extraction.")

