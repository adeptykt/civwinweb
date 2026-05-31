from PIL import Image

def find_bounds():
    img = Image.open('src/assets/leaders.png').convert('RGB')
    w, h = img.size
    
    # Let's find vertical lines of magenta to demarcate columns
    # and horizontal lines for rows
    
    def is_magenta(c):
        return c[0] == 255 and c[1] == 67 and c[2] == 255
        
    print(f"Size: {w}x{h}")

    # Look for magenta pixels to understand the actual grid layout
    magenta_xs = []
    for x in range(w):
        if is_magenta(img.getpixel((x, h//2))):
            magenta_xs.append(x)
            
    print("Magenta Xs:", magenta_xs)

find_bounds()
