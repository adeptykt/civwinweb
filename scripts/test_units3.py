import numpy as np
from PIL import Image

img = Image.open('src/assets/civ1units.png')
data = np.array(img)

# Print unique colors in bottom 20 rows
# Or find grid lines. If it's 28 units, 641 / 28 = 22.89.
# Maybe each unit is 22 pixels wide? 28*22 = 616.
# Maybe 20 pixels wide?
# Or maybe there's a margin.
print("Shape", data.shape)
bg_color = data[389, 0]
print("Bg color", bg_color)
for h in range(389, max(0, 389-40), -1):
    row = data[h]
    # find where row differs from bg_color
    diff = np.any(row != bg_color, axis=1)
    if np.any(diff):
        print(f"Row {h} has {np.sum(diff)} non-bg pixels")
