from PIL import Image

def is_magenta(c): return c[0] == 255 and c[1] == 67 and c[2] == 255

def get_block_bounds(c, r):
    img = Image.open('src/assets/leaders.png').convert('RGB')
    bx = 325 * c
    by = 205 * r
    
    # x bounds for face vs portrait
    face_w = 0
    port_start = -1
    port_end = -1
    
    for x in range(bx, bx + 325):
        if x >= img.width: break
        if is_magenta(img.getpixel((x, by + 10))):
            face_w = x - bx - 1
            break
            
    for x in range(bx + face_w + 1, bx + 325):
        if x >= img.width: break
        if not is_magenta(img.getpixel((x, by + 10))) and port_start == -1:
            port_start = x - bx
        elif is_magenta(img.getpixel((x, by + 10))) and port_start != -1:
            port_end = x - bx - 1
            break
            
    return port_start, port_end

print(f"Block 0,0: {get_block_bounds(0, 0)}")

