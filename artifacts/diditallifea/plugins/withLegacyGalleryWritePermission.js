const { withAndroidManifest } = require('expo/config-plugins');

// Android 10+ saves app-created photos through scoped MediaStore without any
// storage permission. Only Android 9 and earlier need the legacy write grant.
module.exports = function withLegacyGalleryWritePermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const permissions = manifest['uses-permission'] ?? [];
    const name = 'android.permission.WRITE_EXTERNAL_STORAGE';
    const matches = permissions.filter((permission) => permission.$?.['android:name'] === name);
    if (matches.length === 0) {
      permissions.push({ $: { 'android:name': name, 'android:maxSdkVersion': '28' } });
    } else {
      for (const permission of matches) {
        permission.$['android:maxSdkVersion'] = '28';
      }
    }
    manifest['uses-permission'] = permissions;
    return config;
  });
};