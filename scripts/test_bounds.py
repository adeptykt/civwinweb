from PIL import Image

def get_bounds(img_path):
    img = Image.open(img_path).convert("RGBA")
    data = img.load()
    w, h = img.size
    
    # Assume top-left pixel is background color
    bg = data[0,0]
    
    min_x, min_y = w, h
    max_x, max_y = 0, 0
    
    for y in range(h):
        for x in range(w):
            p = data[x,y]
            # Simple threshold to find non-background
            # Or if really transparent... wait alpha is 255
            # let's just check if it's not close to bg
            if abs(p[0]-bg[0]) > 10 or abs(p[1]-bg[1]) > 10 or abs(p[2]-bg[2]) > 10:
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
                
    print(f"Bounds for {img_path}: {min_x}, {min_y} to {max_x}, {max_y} (size {w}x{h})")

import glob
for p in glob.glob('src/assets/v3units/*.png')[:5]:
    get_bounds(p)
    
