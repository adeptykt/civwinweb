from PIL import Image

img = Image.open('src/assets/leaders.png').convert('RGB')
w, h = img.size

def is_magenta(r, g, b):
    return r == 255 and g == 67 and b == 255

def get_block_bounds(c, r):
    block_w = w // 3
    block_h = h // 5
    bx = c * block_w
    by = r * block_h
    
    start_x = -1
    for x in range(bx + 150, bx + block_w):
        c_px = img.getpixel((x, by + 10))
        if not is_magenta(c_px[0], c_px[1], c_px[2]):
            start_x = x
            break
            
    end_x = -1
    if start_x != -1:
        for x in range(start_x, bx + block_w):
            c_px = img.getpixel((x, by + 10))
            if is_magenta(c_px[0], c_px[1], c_px[2]):
                break
            end_x = x
            
    print(f"[{c},{r}] px_start={start_x}, px_end={end_x} ... relative: {start_x - bx} to {end_x - bx}")

for r in range(5):
    for c in range(3):
        if r == 4 and c == 2:
            break
        get_block_bounds(c, r)
