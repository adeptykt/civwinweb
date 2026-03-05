import numpy as np
from PIL import Image

img = Image.open('src/assets/civ1units.png')
data = np.array(img)

# Usually civilization sprites are in a regular grid.
# Let's find horizontal lines that are purely background color.

bg_color = data[389, 0]
print("BG color", bg_color)
is_bg_row = np.all(np.all(data == bg_color, axis=2), axis=1)

for r in range(data.shape[0]):
    if not is_bg_row[r]:
        pass
        
row_blocks = []
in_block = False
start = 0
for r in range(data.shape[0]):
    if not is_bg_row[r] and not in_block:
        in_block = True
        start = r
    elif is_bg_row[r] and in_block:
        in_block = False
        row_blocks.append((start, r-1, r-1 - start + 1))
if in_block:
    row_blocks.append((start, data.shape[0]-1, data.shape[0]-1 - start + 1))

print("Row blocks (start, end, height):")
for b in row_blocks[-10:]:
    print(b)
    
