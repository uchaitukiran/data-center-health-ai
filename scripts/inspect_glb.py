import json
import struct

with open('datacente_model/dc with int.glb', 'rb') as f:
    data = f.read()

magic, version, length = struct.unpack('<4sII', data[:12])
chunk_length, chunk_type = struct.unpack('<II', data[12:20])
glb_json = json.loads(data[20:20+chunk_length].decode('utf-8'))

print(f"Total nodes: {len(glb_json.get('nodes', []))}")
print(f"Total meshes: {len(glb_json.get('meshes', []))}")
print(f"Total materials: {len(glb_json.get('materials', []))}")

print("\nScenes and Roots:")
for s in glb_json.get('scenes', []):
    print("Scene:", s.get('name'), "Roots:", s.get('nodes'))

print("\nNodes:")
for i, n in enumerate(glb_json.get('nodes', [])):
    name = n.get('name', '')
    if any(k in name.lower() for k in ['root', 'sketchfab', 'cluster', 'room', 'plane', 'collada', 'lamp']):
        print(f"Node {i}: name='{name}', mesh={n.get('mesh')}, children={n.get('children')}")

print("\nMaterials:")
for i, m in enumerate(glb_json.get('materials', [])):
    print(f"Mat {i}: {m.get('name')}")
