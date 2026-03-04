from PIL import Image
img = Image.open('src/assets/leaders.png').convert('RGB')

# Look at Hammurabi's wand. It's on the left side of his portrait.
# His portrait is 506 to 649 (width 144)
for x in range(480, 520):
    c = img.getpixel((x, 500))
    # print all pixels around the border between face and portrait
    if c != (255, 67, 255): # not magenta
        print(f"Non-magenta at x={x}: {c}")

