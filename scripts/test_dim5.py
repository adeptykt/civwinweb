from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

bx = 506
by = 411
w = 144
h = 203
print(f"Hammurabi top left: {img.getpixel((bx, by))}")
print(f"Hammurabi top right: {img.getpixel((bx+w-1, by))}")
print(f"Hammurabi bot left: {img.getpixel((bx, by+h-1))}")
print(f"Hammurabi bot right: {img.getpixel((bx+w-1, by+h-1))}")

# Check inner bounding for the small faces just in case
print(f"Hammurabi face grid starts around {325 + 1}, width={180}")

