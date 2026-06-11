# 3D Rocket Models

The **Rocket Hangar** (`rockets.js`) loads a glTF model for each vehicle from this
folder and displays it next to the live spec sheet parsed from the SpaceX API
(`https://api.spacexdata.com/v4/rockets`, with a bundled fallback).

## Folder layout

Drop one folder per vehicle, named by its **normalized key** (lowercase,
alphanumerics only). Each must contain a `scene.gltf` (plus its `.bin` / textures)
or a single self-contained `.glb` renamed to `scene.gltf`:

```
assets/models/
├── falcon9/scene.gltf
├── falconheavy/scene.gltf
├── starship/scene.gltf
├── falcon1/scene.gltf
├── newshepard/scene.gltf
├── newglenn/scene.gltf
└── bluemoon/scene.gltf
```

The key is derived from the rocket name: `Falcon 9` → `falcon9`,
`Falcon Heavy` → `falconheavy`, `New Glenn` → `newglenn`, etc.
(see `normalizeKey()` in `rockets.js`). If a folder is missing, the viewer
shows a placeholder — nothing breaks.

## Register the model in `manifest.json`

After dropping a model folder, add its key to `manifest.json` so the hangar
knows to load it (this keeps the console clean — no 404 probes for models that
aren't there):

```json
["starship", "falcon9"]
```

Only keys listed here are loaded into `<model-viewer>`; everything else shows
the placeholder.

## Where to get models

These are **not** redistributed with this repo. Download them yourself and check
each model's license before committing to a public repo:

- **Sketchfab** — https://sketchfab.com/tags/spacex · https://sketchfab.com/tags/blueorigin
  (filter "Downloadable"; most are CC-BY — keep the attribution).
- **CGTrader** — https://www.cgtrader.com/3d-models/spacex-rocket (paid marketplace).
- **NASA 3D Resources** — https://nasa3d.arc.nasa.gov / https://github.com/nasa/NASA-3D-Resources
  (public domain; convert to glTF if needed).

> ⚠️ Sketchfab/CGTrader models are individually licensed. Committing them to a
> public GitHub Pages repo is a redistribution decision — verify the license
> (attribution, paid, redistribution terms) for each one first.

## Converting to glTF

If a model is `.fbx` / `.obj` / `.blend`, convert it (Blender → "Export → glTF 2.0",
or `npx obj2gltf -i model.obj -o scene.gltf`). Keep files reasonably small
(< ~10 MB) so the page stays fast.
