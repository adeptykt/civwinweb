import numpy as np
from PIL import Image

img = Image.open('src/assets/civ1units.png')
data = np.array(img)

bg_color = data[389, 0]

# check columns in the unit band
band = data[353:383, :]
# find which columns have any non-bg pixels
diff = np.any(band != bg_color, axis=2)
non_bg_cols = np.any(diff, axis=0)
col_indices = np.where(non_bg_cols)[0]

print("Non-bg col indices:")
# find contiguous blocks of non-bg columns
blocks = []
if len(col_indices) > 0:
    start = col_indices[0]
    for i in range(1, len(col_indices)):
        if col_indices[i] != col_indices[i-1] + 1:
            blocks.append((start, col_indices[i-1]))
            start = col_indices[i]
    blocks.append((start, col_indices[-1]))

print(f"Found {len(blocks)} blocks")
for b in blocks:
    print(f"  {b[0]} to {b[1]} (width {b[1]-b[0]+1})")
