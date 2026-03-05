import numpy as np
from PIL import Image

data = np.array(Image.open('src/assets/civ1units.png'))
bg_color = data[389, 0]

for r_start in [321, 353]:
    band = data[r_start:r_start+31, :]
    is_bg_col = np.all(np.all(band == bg_color, axis=2), axis=0)
    col_blocks = []
    in_block = False
    start = 0
    for c in range(1, band.shape[1]):
        if not is_bg_col[c] and not in_block:
            in_block = True
            start = c
        elif is_bg_col[c] and in_block:
            in_block = False
            col_blocks.append((start, c-1))
    if in_block:
        col_blocks.append((start, band.shape[1]-1))
    
    print(f"Row {r_start} has {len(col_blocks)} blocks:")
    print([b[0]//32 for b in col_blocks])
