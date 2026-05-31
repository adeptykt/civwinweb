from PIL import Image

img = Image.open('src/assets/v3units/settler.png').convert("RGBA")
w, h = img.size

non_bg = 0
for y in range(h):
    for x in range(w):
        p = img.getpixel((x,y))
        r,g,b,a = p
        
        # Is it part of the gray/white checkerboard?
        is_gray = abs(r-192)<20 and abs(g-192)<20 and abs(b-192)<20
        is_white = r>240 and g>240 and b>240
        
        if not (is_gray or is_white):
            non_bg += 1

print(f"Non-checkerboard pixels: {non_bg} out of {w*h}")
