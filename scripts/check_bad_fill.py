from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

# Let's see if 0,0,155 touches the edge somehow or if the flood fill is aggressive
for x in range(img.width):
    if img.getpixel((x, 0)) == (0, 0, 155) or img.getpixel((x, img.height-1)) == (0, 0, 155):
        print("0,0,155 touches top/bottom border")
for y in range(img.height):
    if img.getpixel((0, y)) == (0, 0, 155) or img.getpixel((img.width-1, y)) == (0, 0, 155):
        print("0,0,155 touches left/right border")

# It's more likely that the background color and the inner color connected?
# Let's count the number of pixels of 0,0,155 in Lincoln's block
x_start = 1 * 323 + 195
y_start = 1 * 204

dark_blue = sum(1 for y in range(y_start, y_start+204) for x in range(x_start, x_start+128) if img.getpixel((x, y)) == (0, 0, 155))
print("Dark blue pixels in Lincoln small block:", dark_blue)

