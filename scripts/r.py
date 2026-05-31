from PIL import Image
img = Image.open('src/assets/leaders.png').convert('RGB')
pixels = img.load()
visited = set()
queue = []
for y in range(0, 204):
    for x in [517, 645]:
        if pixels[x, y] in [(0, 0, 0), (0, 0, 155)]: queue.append((x, y)); visited.add((x, y))
for x in range(517, 646):
    for y in [0, 203]:
        if pixels[x, y] in [(0, 0, 0), (0, 0, 155)] and (x, y) not in visited: queue.append((x, y)); visited.add((x, y))
flood_count = 0
while queue:
    x, y = queue.pop(0)
    flood_count += 1
    for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
        nx, ny = x + dx, y + dy
        if 517 <= nx < 646 and 0 <= ny < 204 and (nx, ny) not in visited:
            if pixels[nx, ny] in [(0, 0, 0), (0, 0, 155)]:
