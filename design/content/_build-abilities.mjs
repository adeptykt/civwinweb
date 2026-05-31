/**
 * Генератор design/content/abilities.json из юнитов + справочник эффектов
 * Запуск: node design/content/_build-abilities.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const units = JSON.parse(readFileSync(join(dir, 'units.data.json'), 'utf8'));

const DEFS = {
  air_intercept: { category: 'combat', ru: 'Перехват в воздухе', en: 'Air intercept', target: 'unit' },
  air_medevac: { category: 'support', ru: 'Воздушная медэвакуация', en: 'Air medevac', target: 'unit' },
  air_strike: { category: 'combat', ru: 'Воздушный удар', en: 'Air strike', target: 'tile' },
  bombard_city_walls: { category: 'combat', ru: 'Обстрел городских стен', en: 'Bombard city walls', target: 'city' },
  bonus_vs_cavalry: { category: 'combat', ru: 'Бонус против кавалерии', en: 'Bonus vs cavalry', target: 'unit' },
  bonus_vs_fortified: { category: 'combat', ru: 'Бонус против укреплённых', en: 'Bonus vs fortified', target: 'unit' },
  build_improvement_fast: { category: 'construction', ru: 'Быстрое улучшение', en: 'Fast improvement', target: 'tile' },
  build_rail_when_available: { category: 'construction', ru: 'Построить рельсы', en: 'Build railroad', target: 'tile' },
  build_road: { category: 'construction', ru: 'Построить дорогу', en: 'Build road', target: 'tile' },
  build_tile_improvement: { category: 'construction', ru: 'Улучшить клетку', en: 'Build tile improvement', target: 'tile' },
  bypass_walls: { category: 'combat', ru: 'Обход городских стен', en: 'Bypass walls', target: 'city' },
  cannot_attack: { category: 'restriction', ru: 'Не может атаковать', en: 'Cannot attack', target: 'self' },
  cannot_attack_first: { category: 'restriction', ru: 'Не атакует первым', en: 'Cannot strike first', target: 'self' },
  cannot_capture_city: { category: 'restriction', ru: 'Не захватывает город', en: 'Cannot capture city', target: 'self' },
  cannot_found_city: { category: 'restriction', ru: 'Не может основать город', en: 'Cannot found city', target: 'self' },
  cannot_move: { category: 'restriction', ru: 'Не двигается', en: 'Cannot move', target: 'self' },
  chart_continent: { category: 'scout', ru: 'Картирование континента', en: 'Chart continent', target: 'map' },
  clean_pollution: { category: 'ecology', ru: 'Очистить загрязнение', en: 'Clean pollution', target: 'tile' },
  climate_data: { category: 'scout', ru: 'Данные климата', en: 'Climate data', target: 'empire' },
  coastal_only: { category: 'movement', ru: 'Только у берега', en: 'Coastal only', target: 'self' },
  culture_burst: { category: 'culture', ru: 'Культурный всплеск', en: 'Culture burst', target: 'city' },
  culture_burst_on_ancient_ruin: { category: 'culture', ru: 'Культура на руинах', en: 'Culture on ruins', target: 'tile' },
  defense_bonus: { category: 'combat', ru: 'Бонус к обороне', en: 'Defense bonus', target: 'self' },
  enter_foreign_city: { category: 'diplomatic', ru: 'Войти в чужой город', en: 'Enter foreign city', target: 'city' },
  establish_trade_route: { category: 'economic', ru: 'Торговый маршрут', en: 'Trade route', target: 'city' },
  flip_city_loyalty: { category: 'culture', ru: 'Смена лояльности', en: 'Flip loyalty', target: 'city' },
  forest_penalty: { category: 'movement', ru: 'Штраф в лесу', en: 'Forest penalty', target: 'self' },
  found_city: { category: 'civilian', ru: 'Основать город', en: 'Found city', target: 'tile' },
  hack_city_production: { category: 'cyber', ru: 'Саботаж производства', en: 'Hack production', target: 'city' },
  heal_adjacent: { category: 'support', ru: 'Лечит соседей', en: 'Heal adjacent', target: 'unit' },
  heal_adjacent_friendly: { category: 'support', ru: 'Лечит союзников рядом', en: 'Heal nearby allies', target: 'unit' },
  ignore_coastal_limit: { category: 'movement', ru: 'Вне лимита берега', en: 'Ignore coastal limit', target: 'self' },
  ignore_terrain: { category: 'movement', ru: 'Игнор местности', en: 'Ignore terrain', target: 'self' },
  ignore_terrain_move_cost: { category: 'movement', ru: 'Игнор стоимости местности', en: 'Ignore terrain move cost', target: 'self' },
  immune_pollution: { category: 'ecology', ru: 'Иммунитет к загрязнению', en: 'Immune to pollution', target: 'self' },
  incite_unrest: { category: 'diplomatic', ru: 'Поднять беспорядки', en: 'Incite unrest', target: 'city' },
  missile_strike: { category: 'combat', ru: 'Ракетный удар', en: 'Missile strike', target: 'tile' },
  must_finish_in_city: { category: 'space', ru: 'Достраивается в городе', en: 'Must finish in city', target: 'city' },
  naval_bombard: { category: 'combat', ru: 'Морской обстрел', en: 'Naval bombard', target: 'tile' },
  negotiate_treaty: { category: 'diplomatic', ru: 'Заключить соглашение', en: 'Negotiate treaty', target: 'empire' },
  no_morale_loss: { category: 'combat', ru: 'Без потери морали', en: 'No morale loss', target: 'self' },
  no_phalanx_bonus: { category: 'combat', ru: 'Игнор бонуса строя', en: 'No phalanx bonus', target: 'unit' },
  no_upkeep_when_fortified: { category: 'logistics', ru: 'Без содержания в укреплении', en: 'No upkeep when fortified', target: 'self' },
  open_terrain_bonus: { category: 'combat', ru: 'Бонус на открытой местности', en: 'Open terrain bonus', target: 'self' },
  phalanx_bonus_adjacent_friendly: { category: 'combat', ru: 'Бонус строя соседям', en: 'Phalanx bonus for allies', target: 'unit' },
  pierce_light_armor: { category: 'combat', ru: 'Пробивает лёгкую броню', en: 'Pierce light armor', target: 'unit' },
  plant_forest: { category: 'ecology', ru: 'Посадить лес', en: 'Plant forest', target: 'tile' },
  predict_rival_tech: { category: 'diplomatic', ru: 'Прогноз техов соперника', en: 'Predict rival tech', target: 'empire' },
  rail_move_only: { category: 'movement', ru: 'Только по рельсам', en: 'Rail move only', target: 'self' },
  ranged_attack: { category: 'combat', ru: 'Дальний бой', en: 'Ranged attack', target: 'unit' },
  recon_strike: { category: 'combat', ru: 'Разведывательный удар', en: 'Recon strike', target: 'unit' },
  reduce_upkeep_nearby: { category: 'support', ru: 'Снижает содержание рядом', en: 'Reduce nearby upkeep', target: 'unit' },
  requires_airbase: { category: 'movement', ru: 'Требуется авиабаза', en: 'Requires airbase', target: 'self' },
  retreat_after_attack: { category: 'combat', ru: 'Отступление после атаки', en: 'Retreat after attack', target: 'self' },
  reveal_global: { category: 'scout', ru: 'Глобальная разведка', en: 'Global reveal', target: 'map' },
  reveal_ocean_tiles: { category: 'scout', ru: 'Открывает океан', en: 'Reveal ocean', target: 'map' },
  reveal_radius_2: { category: 'scout', ru: 'Открывает туман (радиус 2)', en: 'Reveal fog (radius 2)', target: 'map' },
  reveal_radius_3: { category: 'scout', ru: 'Открывает туман (радиус 3)', en: 'Reveal fog (radius 3)', target: 'map' },
  road_bonus: { category: 'movement', ru: 'Бонус на дорогах', en: 'Road bonus', target: 'self' },
  rough_terrain_bonus: { category: 'combat', ru: 'Бонус на пересечёнке', en: 'Rough terrain bonus', target: 'self' },
  sabotage_improvement: { category: 'cyber', ru: 'Саботаж улучшения', en: 'Sabotage improvement', target: 'tile' },
  siege_bonus_vs_city: { category: 'combat', ru: 'Осадный бонус против города', en: 'Siege bonus vs city', target: 'city' },
  slow_setup: { category: 'combat', ru: 'Медленная подготовка', en: 'Slow setup', target: 'self' },
  space_race_part: { category: 'space', ru: 'Часть космического корабля', en: 'Space race part', target: 'city' },
  spotter_bonus: { category: 'combat', ru: 'Бонус наведения', en: 'Spotter bonus', target: 'unit' },
  steal_tech_chance: { category: 'cyber', ru: 'Шанс украсть технологию', en: 'Steal tech chance', target: 'empire' },
  stealth_sea: { category: 'combat', ru: 'Скрытность на море', en: 'Stealth at sea', target: 'self' },
  supply_radius_1: { category: 'logistics', ru: 'Снабжение в радиусе 1', en: 'Supply radius 1', target: 'unit' },
  suppress_partisans: { category: 'diplomatic', ru: 'Подавление партизан', en: 'Suppress partisans', target: 'city' },
  trade_route_boost: { category: 'economic', ru: 'Усиление торговых путей', en: 'Trade route boost', target: 'empire' },
  trade_route_sea: { category: 'economic', ru: 'Морской торговый путь', en: 'Sea trade route', target: 'city' },
  trample: { category: 'combat', ru: 'Пробивание строем', en: 'Trample', target: 'unit' },
  transport_capacity_2: { category: 'logistics', ru: 'Перевозка: 2 юнита', en: 'Transport capacity 2', target: 'unit' },
  transport_capacity_4: { category: 'logistics', ru: 'Перевозка: 4 юнита', en: 'Transport capacity 4', target: 'unit' },
  transport_capacity_6: { category: 'logistics', ru: 'Перевозка: 6 юнитов', en: 'Transport capacity 6', target: 'unit' },
  transport_capacity_8: { category: 'logistics', ru: 'Перевозка: 8 юнитов', en: 'Transport capacity 8', target: 'unit' },
  transport_capacity_10: { category: 'logistics', ru: 'Перевозка: 10 юнитов', en: 'Transport capacity 10', target: 'unit' },
  visibility_sea_2: { category: 'scout', ru: 'Видимость на море (2)', en: 'Sea visibility 2', target: 'map' },
  wonder_contribution: { category: 'economic', ru: 'Вклад в чудо', en: 'Wonder contribution', target: 'city' },
  zone_of_control: { category: 'combat', ru: 'Зона контроля', en: 'Zone of control', target: 'tile' },
};

const ids = new Set();
for (const u of units) {
  for (const a of u.abilities ?? []) ids.add(a);
}

const abilities = [...ids].sort().map((id) => {
  const d = DEFS[id];
  if (!d) {
    console.warn(`Missing DEFS for ability: ${id}`);
  }
  const def = d ?? {
    category: 'special',
    ru: id.replace(/_/g, ' '),
    en: id.replace(/_/g, ' '),
    target: 'self',
  };
  return {
    id,
    name: { ru: def.ru, en: def.en },
    category: def.category,
    target: def.target,
    implementation_status: 'design_only',
    description: {
      ru: `Способность «${def.ru}» — см. движок (фаза 5).`,
      en: `Ability "${def.en}" — engine TBD (phase 5).`,
    },
  };
});

const out = {
  meta: {
    version: '1.0.0',
    title: 'CivWin — способности юнитов',
    description: 'Справочник ability id из units.data.json для реализации в UnitAbilities.',
    locale_primary: 'ru',
    actual_count: abilities.length,
  },
  categories: [
    { id: 'civilian', name: { ru: 'Гражданские', en: 'Civilian' } },
    { id: 'construction', name: { ru: 'Строительство', en: 'Construction' } },
    { id: 'combat', name: { ru: 'Бой', en: 'Combat' } },
    { id: 'support', name: { ru: 'Поддержка', en: 'Support' } },
    { id: 'scout', name: { ru: 'Разведка', en: 'Scout' } },
    { id: 'diplomatic', name: { ru: 'Дипломатия', en: 'Diplomatic' } },
    { id: 'economic', name: { ru: 'Экономика', en: 'Economic' } },
    { id: 'cyber', name: { ru: 'Кибер', en: 'Cyber' } },
    { id: 'culture', name: { ru: 'Культура', en: 'Culture' } },
    { id: 'ecology', name: { ru: 'Экология', en: 'Ecology' } },
    { id: 'logistics', name: { ru: 'Логистика', en: 'Logistics' } },
    { id: 'movement', name: { ru: 'Движение', en: 'Movement' } },
    { id: 'restriction', name: { ru: 'Ограничения', en: 'Restrictions' } },
    { id: 'space', name: { ru: 'Космос', en: 'Space' } },
    { id: 'special', name: { ru: 'Особые', en: 'Special' } },
  ],
  abilities,
};

writeFileSync(join(dir, 'abilities.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Written ${abilities.length} abilities`);
