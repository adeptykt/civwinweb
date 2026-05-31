from PIL import Image

def get_settler_bbox():
    img = Image.open('src/assets/civ1units.png').convert("RGBA")
    block = img.crop((0, 320, 32, 352))
    
    # get the transparent color from the top-left pixel
    pixels = block.load()
    transparent_color = pixels[0, 0]
    
    # For fully transparent RGBA handling or specific transparent color:
    # If the image uses actual alpha transparency instead of color keying:
    bbox = block.getbbox()
    
    min_x, min_y = 32, 32
    max_x, max_y = 0, 0
    actual_transparency = False
    
    for y in range(32):
        for x in range(32):
            p = pixels[x, y]
            # check if alpha is 0
            if p[3] == 0:
                actual_transparency = True
            
            # Not transparent if alpha > 0 and not our background color if using color keyed
            is_transparent = p[3] == 0 or (not actual_transparency and p == transparent_color)
            if not is_transparent:
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
                
    if actual_transparency:
        # Just use built-in bbox if real transparency exists and getbbox worked (meaning not returning whole box if it shouldn't)
        pass # but getbbox returned 0,0,32,32 earlier, indicating mostly not alpha=0 boundaries
    
    print(f"Computed bounding box: (left={min_x}, upper={min_y}, right={max_x+1}, lower={max_y+1})")
    print(f"PIL getbbox: {bbox}")

get_settler_bbox()
