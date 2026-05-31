from PIL import Image
img = Image.open('src/assets/settler.png').convert("RGBA")
print("v1 settler alpha:", img.getextrema()[3])
