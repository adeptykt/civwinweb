from PIL import Image

def is_magenta(c):
    return c[0] == 255 and c[1] == 67 and c[2] == 255

def run():
    img = Image.open('src/assets/leaders.png').convert('RGB')
    
    xs = []
    # scan for portrait start
    # at y=10
    
    # for c=0
    for x in range(300):
        if not is_magenta(img.getpixel((x, 10))):
            print("c=0 face/portrait starts at:", x)
            break
            
    # for c=0, where does face end?
    for x in range(140, 200):
        if is_magenta(img.getpixel((x, 10))):
            print("c=0 face ends at:", x)
            break
            
    # for c=0 portrait start
    for x in range(130, 200):
        if not is_magenta(img.getpixel((x, 10))) and is_magenta(img.getpixel((x-1, 10))):
            print("c=0 portrait next part starts at:", x)
            break

run()
