from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

# Wait... 326 to 624 is width 299.
# Where do the faces actually start/end? Where is the rightmost black text block or non-transparent edge?
# What is the left-side bound limit of the portrait in that 299 block at y=450?
start = False
port_start = -1
for x in range(326, 624):
    c = img.getpixel((x, 450))
    if c[0] == c[1] == c[2] == 0:
        continue # Ignore pure black
    if port_start == -1:
        port_start = x
        break

print(f"In row 450, left-most colored pixel is at {port_start}.")

