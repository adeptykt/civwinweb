from PIL import Image

img = Image.open('src/assets/leaders.png').convert('RGB')

def is_magenta(c):
    return c[0] == 255 and c[1] == 67 and c[2] == 255

row_starts = [0, 205, 410, 615, 820]
col_starts = [0, 325, 650]

for r in range(1):
    for c in range(1):
        sx = col_starts[c]
        sy = row_starts[r]
        
        px_end_face = -1
        # Scan from left to find end of faces
        for x in range(sx, sx + 140):
            c0 = img.getpixel((x, sy + 10))
            if not is_magenta(c0):
                px_end_face = x
                
        px_start_portrait = -1
        for x in range(px_end_face, sx + 320):
            c0 = img.getpixel((x, sy + 10))
            if not is_magenta(c0):
                px_start_portrait = x
                break

        print(f"[{c},{r}] Face ends around: {px_end_face - sx}, Portrait starts at: {px_start_portrait - sx}")

