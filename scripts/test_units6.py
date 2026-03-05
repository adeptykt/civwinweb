import numpy as np
from PIL import Image

data = np.array(Image.open('src/assets/civ1units.png'))
bg_color = data[389, 0]

band = data[321:383, :]
# Find columns that are purely background
is_bg_col = np.all(np.all(band == bg_color, axis=2), axis=0)

col_blocks = []
in_block = False
start = 0
for c in range(band.shape[1]):
    if not is_bg_col[c] and not in_block:
        in_block = True
        start = c
    elif is_bg_col[c] and in_block:
        in_block = False
        col_blocks.append((start, c-1, c-1 - start + 1))
if in_block:
    col_blocks.append((start, band.shape[1]-1, band.shape[1]-1 - start + 1))

print(f"Col blocks: {len(col_blocks)}")
for b in col_blocks:
    if b[2] > 5: print(b)
else:
    print("...")
