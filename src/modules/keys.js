export function moduleSettingKey(moduleId) {
  return `module_${moduleId}_enabled`;
}

export function moduleInstalledKey(moduleId) {
  return `module_${moduleId}_installed`;
}

export function moduleConfiguredKey(moduleId) {
  return `module_${moduleId}_configured`;
}

export function roleModuleSettingKey(role, moduleId) {
  return `role_${role}_module_${moduleId}`;
}

export function menuItemSettingKey(menuItemId) {
  return `menu_${menuItemId}_enabled`;
}

export function roleMenuItemSettingKey(role, menuItemId) {
  return `role_${role}_menu_${menuItemId}`;
}

export function isTruthySetting(value) {
  return value === "1" || value === "true" || value === true || value === 1;
}
