from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

black_pixels = 0
for x in range(517, 517 + 129):
    for y in range(0, 204):
        if img.getpixel((x, y)) == (0, 0, 0):
            black_pixels += 1

print("Total black pixels in Cleopatra portrait:", black_pixels)

# Check inside the actual face/body roughly
face_black_pixels = 0
for x in range(517 + 40, 517 + 90):
    for y in range(50, 150):
        if img.getpixel((x, y)) == (0, 0, 0):
            face_black_pixels += 1
            
print("Black pixels in Cleopatra face/body region:", face_black_pixels)

