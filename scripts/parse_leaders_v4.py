from PIL import Image

img = Image.open('src/assets/leaders.png').convert('RGB')
w, h = img.size

def is_magenta(c):
    return c[0] == 255 and c[1] == 67 and c[2] == 255

def analyze_sheet():
    row_starts = []
    # find row divisions - look at x=200 for magenta
    for y in range(h):
        if is_magenta(img.getpixel((200, y))):
            row_starts.append(y)
    
    col_starts = []
    # find col divisions 
    for x in range(w):
        if is_magenta(img.getpixel((x, 100))):
            col_starts.append(x)
            
    # get just the start of each group of magenta
    def get_groups(arr):
        if not arr: return []
        groups = [arr[0]]
        for i in range(1, len(arr)):
            if arr[i] > arr[i-1] + 10: # gap
                groups.append(arr[i])
        return groups
        
    print("Magenta row gaps around:", get_groups(row_starts))
    print("Magenta col gaps around:", get_groups(col_starts))

analyze_sheet()
