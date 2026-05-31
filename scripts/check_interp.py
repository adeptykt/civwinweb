from PIL import Image

def get_guy_bounds():
    img = Image.open('src/assets/v3units/settler.png').convert("RGBA")
    # scale it down to 64x64 like the browser does
    img = img.resize((64, 64), Image.Resampling.BILINEAR)
    w, h = img.size
    
    non_bg = 0
    import math
    for y in range(h):
        for x in range(w):
            p = img.getpixel((x,y))
            r,g,b,a = p
            
            # Is it bright grayscale?
            # standard deviation of r,g,b is small
            avg = (r+g+b)/3
            is_gray = abs(r-avg)<15 and abs(g-avg)<15 and abs(b-avg)<15
            is_bright = avg > 170
            
            if not (is_gray and is_bright):
                non_bg += 1
                
    print(f"Non-bg pixels: {non_bg} out of {w*h}")

get_guy_bounds()
