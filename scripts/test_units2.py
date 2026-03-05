import numpy as np
from PIL import Image

img = Image.open('src/assets/civ1units.png').convert('RGB')
data = np.array(img)

# Print a few pixels from the bottom row
print(data[389, :20])
