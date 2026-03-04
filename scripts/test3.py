from PIL import Image

def is_magenta(c):
    return c[0] == 255 and c[1] == 67 and c[2] == 255

def run():
    img = Image.open('src/assets/leaders.png').convert('RGB')
    
    # scan for block 0,0 dimensions
    # face width:
    face_w = 0
    for x in range(1, 150):
        if is_magenta(img.getpixel((x, 10))):
            face_w = x - 1
            break
            
    # portrait width:
    port_start = -1
    port_end = -1
    for x in range(face_w + 1, 350):
        if not is_magenta(img.getpixel((x, 10))) and port_start == -1:
            port_start = x
        elif is_magenta(img.getpixel((x, 10))) and port_start != -1:
            port_end = x - 1
            break
            
    print(f"Face W: {face_w}")
    print(f"Port start: {port_start}")
    print(f"Port end: {port_end}")
    print(f"Port w: {port_end - port_start + 1}")
    print(f"Block total width: {port_end}")

run()
