import numpy as np
from PIL import Image

data = np.array(Image.open('src/assets/civ1units.png'))
print(data.shape)
# assume grid is 32x32, 20 columns
# check exactly 20 cols
for r in [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352]:
    print(r)
