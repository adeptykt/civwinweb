from PIL import Image

img = Image.open('src/assets/v3units/settler.png').convert("RGBA")
w, h = img.size

# Let's count how many pixels are NOT close to gray (193,193,193)
non_bg = 0
min_x = w
max_x = 0
min_y = h
max_y = 0

for y in range(h):
    for x in range(w):
        p = img.getpixel((x,y))
        # strictly not close to gray
        if abs(p[0]-193)>30 or abs(p[1]-193)>30 or abs(p[2]-193)>30:
            non_bg += 1
            if x < min_x: min_x = x
            if x > max_x: max_x = x
            if y < min_y: min_y = y
            if y > max_y: max_y = y

print(f"Non-bg pixels: {non_bg} out of {w*h}")
print(f"Guy bounds: {min_x}, {min_y} to {max_x}, {max_y}")
