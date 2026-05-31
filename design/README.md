# CivWin — дизайн-данные

Оригинальное дерево контента (не Civ I/II). Исходники — `*.data.json`, сборка — `_build-*.mjs` → `*.json`.

## Каталоги

| Файл | Штук | Описание |
|------|------|----------|
| `technologies` | 134 | Дерево исследований |
| `units` | 58 | Юниты |
| `buildings` | 41 | Городские постройки |
| `wonders` | 24 | Чудеса света |
| `improvements` | 16 | Улучшения клеток |
| `governments` | 9 | Формы правления |
| `resources` | 9 | Ресурсы |
| `events` | 4 | События |
| `abilities` | ~75 | Справочник способностей (из юнитов) |

## Команды

```bash
npm run design:build
npm run design:validate
```

Или вручную:

```bash
node design/scripts/build-all.mjs
node design/scripts/validate-content.mjs
```

## Правила id

- `snake_case`, латиница
- Технология открывает контент через `unlocks` в `technologies.data.json`
- Дублировать связь в каталоге через `requires_tech` (для производства/UI)

## Эпохи

`ancient` → `classical` → `medieval` → `renaissance` → `industrial` → `modern` → `information` → `digital`

## Следующий этап (фаза 3+)

Подключить JSON в игру: `ContentRegistry`, исследования, производство, эффекты зданий/чудес, способности юнитов.
