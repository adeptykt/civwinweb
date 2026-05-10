import { BuildingType, UnitType } from '../types/game';
import { t } from '../i18n/I18nService.js';

/**
 * Utility functions to convert game IDs to human-readable display names
 */

export function getBuildingDisplayName(buildingId: BuildingType | string): string {
  const id = buildingId.toString();
  const key = `buildings.${id}.name`;
  const tr = t(key);
  if (tr !== key) return tr;
  return toTitleCase(id);
}

export function getUnitDisplayName(unitId: UnitType | string): string {
  const id = unitId.toString();
  const key = `units.${id}.name`;
  const tr = t(key);
  if (tr !== key) return tr;
  return toTitleCase(id);
}

export function getWonderDisplayName(wonderId: string): string {
  const key = `wonders.${wonderId}.name`;
  const tr = t(key);
  if (tr !== key) return tr;
  return toTitleCase(wonderId);
}

export function getGovernmentDisplayName(governmentId: string): string {
  const key = `governments.${governmentId}`;
  const tr = t(key);
  if (tr !== key) return tr;
  return toTitleCase(governmentId);
}

export function getImprovementDisplayName(improvementId: string): string {
  const key = `improvements.${improvementId}`;
  const tr = t(key);
  if (tr !== key) return tr;
  return toTitleCase(improvementId);
}

export function getTerrainDisplayName(terrainId: string): string {
  const key = `terrainNames.${terrainId}`;
  const tr = t(key);
  if (tr !== key) return tr;
  return toTitleCase(terrainId);
}

function toTitleCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
