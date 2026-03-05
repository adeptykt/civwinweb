import numpy as np
from PIL import Image

data = np.array(Image.open('src/assets/civ1units.png'))
print(data.shape)

bg_color = data[389, 0]
units = sum([
    [f"Row {r}, Col {c}" for c in range(20)]
for r in [320, 352]], [])

print(f"There are a total of 28 units. A 32x32 grid starting at y=320 fits exactly 20 columns.")
