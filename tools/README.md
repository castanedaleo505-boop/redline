# Building the 3D body

`assets/body.glb` is generated, not hand-edited. To rebuild it:

1. Get the MakeHuman data folder (base mesh, targets, rigs). It is CC0:
   `git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman`
   then `git sparse-checkout set makehuman/data/targets makehuman/data/3dobjs makehuman/data/rigs`
2. `pip install numpy scipy`
3. `python3 tools/build_body.py <path>/makehuman/data assets/body.glb` (about 90 seconds)

The script fails if the mesh is not watertight or not exactly mirrored left to right.

The body mesh and its shape targets come from MakeHuman (makehumancommunity.org), released as CC0 1.0.
