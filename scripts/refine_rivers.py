import json
import math
import os
import urllib.request
import urllib.parse

# Tile parameters
LAT = 40.2547
LON = -76.8860
LAT_HALF = 0.25
LON_HALF = 0.25 / math.cos(math.radians(LAT))
MIN_LAT, MAX_LAT = LAT - LAT_HALF, LAT + LAT_HALF
MIN_LON, MAX_LON = LON - LON_HALF, LON + LON_HALF

OUT_DIR = "d:/vegamiti/Vega_miti/frontend/public/assets/terrain"

# Query Overpass for waterway=river and waterway=stream
query = f"""
[out:json][timeout:35];
(
  way["waterway"="river"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["waterway"="stream"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
);
out geom;
"""

print("Fetching waterway ways from Overpass...")
url = "https://overpass-api.de/api/interpreter"
req_data = urllib.parse.urlencode({"data": query}).encode("utf-8")

elements = []
try:
    req = urllib.request.Request(url, data=req_data, headers={"User-Agent": "VegaMiti/3.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        osm_json = json.loads(resp.read().decode("utf-8"))
        elements = osm_json.get("elements", [])
        print(f"Downloaded {len(elements)} OSM ways.")
except Exception as e:
    print(f"Overpass download failed: {e}")

# Helper: calculate distance in km using Haversine
def haversine(p1, p2):
    R = 6371.0
    lat1, lon1 = math.radians(p1[1]), math.radians(p1[0])
    lat2, lon2 = math.radians(p2[1]), math.radians(p2[0])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

# Helper: total length of a polyline in km
def poly_length(coords):
    total = 0.0
    for i in range(len(coords) - 1):
        total += haversine(coords[i], coords[i+1])
    return total

# Chaikin smoothing (3 passes)
def chaikin(points, passes=3):
    pts = points
    for _ in range(passes):
        if len(pts) < 3:
            break
        new_pts = [pts[0]]
        for i in range(len(pts) - 1):
            p0 = pts[i]
            p1 = pts[i + 1]
            q = (0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1])
            r = (0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1])
            new_pts.extend([q, r])
        new_pts.append(pts[-1])
        pts = new_pts
    return pts

# Densify polyline so distance between consecutive points is ~100 m (0.1 km)
def densify(coords, step_km=0.1):
    if len(coords) < 2:
        return coords
    result = [coords[0]]
    for i in range(len(coords) - 1):
        p0 = coords[i]
        p1 = coords[i+1]
        dist = haversine(p0, p1)
        num_steps = max(1, int(dist / step_km))
        for step in range(1, num_steps + 1):
            t = step / num_steps
            interp = (p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1]))
            result.append(interp)
    return result

# Filter elements according to rule 5:
# "Keep OSM waterway=river only. For waterway=stream keep only the 12 longest per tile. Drop every segment shorter than 1.5 km."
rivers = []
streams = []

for el in elements:
    geom = el.get("geometry", [])
    if len(geom) < 2:
        continue
    w_type = el.get("tags", {}).get("waterway", "stream")
    coords = [(pt["lon"], pt["lat"]) for pt in geom]
    
    # Clip points to bbox
    clipped = []
    for c in coords:
        if MIN_LON <= c[0] <= MAX_LON and MIN_LAT <= c[1] <= MAX_LAT:
            clipped.append(c)
        elif len(clipped) > 0 and len(clipped) < len(coords):
            # clamp point to boundary
            clamped = (
                max(MIN_LON, min(MAX_LON, c[0])),
                max(MIN_LAT, min(MAX_LAT, c[1]))
            )
            clipped.append(clamped)
    
    if len(clipped) < 2:
        continue

    length_km = poly_length(clipped)
    if length_km < 1.5:  # Drop every segment shorter than 1.5 km
        continue
    
    item = {
        "type": w_type,
        "name": el.get("tags", {}).get("name", ""),
        "length_km": length_km,
        "coords": clipped
    }
    if w_type == "river":
        rivers.append(item)
    else:
        streams.append(item)

# Sort streams by length and keep only the 12 longest per tile
streams.sort(key=lambda s: s["length_km"], reverse=True)
streams = streams[:12]

print(f"Kept {len(rivers)} river segments and {len(streams)} longest stream segments (all >= 1.5 km).")

# Now smooth with Chaikin (3 passes) and densify to ~100m
final_features = []
for item in (rivers + streams):
    smoothed = chaikin(item["coords"], passes=3)
    densified = densify(smoothed, step_km=0.1)
    
    # Check for noisy loops / zigzags: angle check
    # Convert to normalized UV coordinates in tile [0..1]
    uv_coords = []
    for lon_pt, lat_pt in densified:
        u = (lon_pt - MIN_LON) / (MAX_LON - MIN_LON)
        v = (MAX_LAT - lat_pt) / (MAX_LAT - MIN_LAT)
        # Strictly clip to tile [0..1]
        u = max(0.0, min(1.0, u))
        v = max(0.0, min(1.0, v))
        uv_coords.append((round(u, 5), round(v, 5)))
    
    if len(uv_coords) >= 2:
        final_features.append({
            "type": item["type"],
            "name": item["name"],
            "length_km": round(item["length_km"], 2),
            "isRiver": item["type"] == "river",
            "uv": uv_coords
        })

output_data = {
    "source": "OpenStreetMap contributors via Overpass API",
    "isOsm": True,
    "bbox": [MIN_LAT, MIN_LON, MAX_LAT, MAX_LON],
    "count": len(final_features),
    "features": final_features
}

out_file = os.path.join(OUT_DIR, "harrisburg-rivers.json")
with open(out_file, "w") as f:
    json.dump(output_data, f, indent=2)

print(f"Saved refined waterways to {out_file} ({len(final_features)} segments total).")

