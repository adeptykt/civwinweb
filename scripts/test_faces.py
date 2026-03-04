from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

bx = 326
by = 411
print(f"Face box starts for Hammurabi at {bx}, {by}")

