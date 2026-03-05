from PIL import Image

try:
    img = Image.open('src/assets/v3units/settler.png')
    img = img.convert("RGBA")
    
    # Check top-left corner
    print("Top-left pixel:", img.getpixel((0,0)))
    
    # Get common colors
    colors = img.getcolors(maxcolors=256)
    if colors:
        colors.sort(reverse=True)
        print("Most common colors:", colors[:5])
    else:
        print("Too many colors")
except Exception as e:
    print(e)
