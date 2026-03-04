from PIL import Image

img = Image.open('src/assets/leaders.png').convert('RGB')

def is_magenta(c):
    return c[0] == 255 and c[1] == 67 and c[2] == 255

row_starts = [0, 205, 410, 615, 820]
col_starts = [0, 325, 650]

for r in range(5):
    for c in range(3):
        if r == 4 and c == 2:
            break
            
        sx = col_starts[c]
        sy = row_starts[r]
        
        px_start = -1
        px_end = -1
        
        # Scan across the top 20 lines to find real portrait bounds
        for y in range(sy + 10, sy + 30):
            for x in range(sx + 140, sx + 320):
                c0 = img.getpixel((x, y))
                if not is_magenta(c0):
                    if px_start == -1 or x < px_start: px_start = x
                    if x > px_end: px_end = x
                    
        print(f"[{c},{r}] absolute px: {px_start} -> {px_end} ... width={px_end - px_start + 1}")

