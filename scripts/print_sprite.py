from PIL import Image

img = Image.open('src/assets/v3units/settler.png').convert("RGBA")
# just print the top left corner colors to see if it's solid
w, h = img.size
print(w,h)
for y in range(10):
    for x in range(10):
        print(img.getpixel((x,y)), end=" ")
    print()
