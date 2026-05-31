import numpy as np
from PIL import Image
data = np.array(Image.open('src/assets/civ1units.png'))
bg_color = data[389, 0]
units_found = 0
for r in [320, 352]:
    for c in range(20):
        # check if it's all background
        block = data[r:r+32, c*32:(c+1)*32]
        if not np.all(block == bg_color):
            units_found += 1
print(f"Total non-bg 32x32 blocks in bottom two rows: {units_found}")
