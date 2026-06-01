import { t } from '../i18n/I18nService.js';
import { BUILDING_DEFINITIONS } from './BuildingDefinitions';
import { WonderDefinitions } from './WonderDefinitions';
import { getAllCivilizations } from './CivilizationDefinitions';
import { TerrainType } from '../types/game';
export interface CivilopediaEntry {
  id: string;
  title: string;
  body: string;
}
import { getBuildingDisplayName, getWonderDisplayName } from '../utils/DisplayNames';
import { BuildingType } from '../types/game';

export function getTerrainCivilopediaEntries(): CivilopediaEntry[] {
  return Object.values(TerrainType).map(terrain => {
    const key = `terrain.${terrain}.description`;
    const desc = t(key);
    return {
      id: terrain,
      title: terrain.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      body: desc !== key ? desc : terrain,
    };
  });
}

export function getBuildingCivilopediaEntries(): CivilopediaEntry[] {
  return Object.values(BuildingType).map(type => {
    const def = BUILDING_DEFINITIONS[type];
    const descKey = `buildings.${type}.description`;
    const localized = t(descKey);
    const body = localized !== descKey ? localized : def?.description ?? '';
    return {
      id: type,
      title: getBuildingDisplayName(type),
      body,
    };
  });
}

export function getWonderCivilopediaEntries(): CivilopediaEntry[] {
  return Object.keys(WonderDefinitions).map(id => {
    const def = WonderDefinitions[id];
    const descKey = `wonders.${id}.description`;
    const localized = t(descKey);
    const body = localized !== descKey ? localized : def.description;
    return {
      id,
      title: getWonderDisplayName(id),
      body,
    };
  });
}

export function getCivilizationCivilopediaEntries(): CivilopediaEntry[] {
  return getAllCivilizations().map(civ => ({
    id: civ.id,
    title: t(`civilizations.${civ.id}.name`),
    body: [
      t(`civilizations.${civ.id}.description`),
      '',
      `${t('templates.civilopediaRef.leader')}: ${civ.leader}`,
      `${t('templates.civilopediaRef.adjective')}: ${civ.adjective}`,
    ].join('\n'),
  }));
}

export function getCompleteCivilopediaEntries(): CivilopediaEntry[] {
  return [
    ...getCivilizationCivilopediaEntries(),
    ...getTerrainCivilopediaEntries(),
    ...getBuildingCivilopediaEntries(),
    ...getWonderCivilopediaEntries(),
  ];
}
