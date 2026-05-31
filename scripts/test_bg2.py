from PIL import Image

try:
    img = Image.open('src/assets/v3units/settler.png')
    img = img.convert("RGBA")
    
    # Get common colors
    colors = img.getcolors(maxcolors=1000000)
    colors.sort(reverse=True)
    print("Most common colors:", colors[:5])
except Exception as e:
    print(e)
