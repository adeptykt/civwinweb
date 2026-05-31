from PIL import Image

# Load the image
img = Image.open('src/assets/civ1units.png')
img = img.convert("RGBA")

# Extract the 32x32 block for the settler at x=0, y=320
block = img.crop((0, 320, 32, 352))

# Find the bounding box of the non-transparent pixels
# getbbox() returns (left, upper, right, lower)
bbox = block.getbbox()

print("Bounding box relative to 32x32 block:", bbox)
