from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

# Find exact face cell dims
# We know from y=411 the first row within block row 2 has cells at: 
# (1, 59, 59), (61, 119, 59), (121, 179, 59), (181, 239, 59), (241, 299, 59) for col 0
# Face cells appear to be 4 per row x 4 per col (standard).
# First face cell: x=1, y=1 to ~y=50 (one row)

# Find face cell height in block 0,0
# At x=30, scan vertically
print("Vertical scan at x=30 for row 0:")
for y in range(0, 210):
    c = img.getpixel((30, y))
    was_m = is_m(c)
    if y > 0:
        prev_m = is_m(img.getpixel((30, y-1)))
        if was_m != prev_m:
            print(f"  y={y}: {'non-magenta start' if not was_m else 'magenta start'}, pixel: {c}")

# Find face cell width in block 0,0
print("\nHorizontal scan at y=30 for col 0 (first 330px):")
for x in range(0, 330):
    c = img.getpixel((x, 30))
    was_m = is_m(c)
    if x > 0:
        prev_m = is_m(img.getpixel((x-1, 30)))
        if was_m != prev_m:
            print(f"  x={x}: {'non-magenta start' if not was_m else 'magenta start'}, pixel: {c}")
