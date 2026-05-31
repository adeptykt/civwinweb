from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

magenta = (255, 67, 255)

print("Magenta at x=323, y=0?", img.getpixel((323, 0)) == magenta)
print("Magenta at x=194, y=0?", img.getpixel((194, 0)) == magenta)

