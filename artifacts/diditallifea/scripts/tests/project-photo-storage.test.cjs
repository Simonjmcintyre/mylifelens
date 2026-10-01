const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../../lib/project-photo-storage.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function storageFixture(os, version = 35, overrides = {}) {
  const calls = [];
  const mediaLibrary = {
    getPermissionsAsync: async (...args) => {
      calls.push(['getPermissions', ...args]);
      return { granted: overrides.iosGranted ?? true };
    },
    requestPermissionsAsync: async (...args) => {
      calls.push(['requestPermissions', ...args]);
      return { granted: overrides.iosRequestGranted ?? false };
    },
    getAlbumAsync: async (name) => {
      calls.push(['getAlbum', name]);
      return overrides.existingAlbum ?? null;
    },
    createAssetAsync: async (...args) => calls.push(['createAsset', ...args]),
    createAlbumAsync: async (...args) => calls.push(['createAlbum', ...args]),
  };
  const nativeAlbums = {
    savePhotoToAlbum: async (options) => {
      calls.push(['nativeSave', options]);
      if (overrides.nativeError) throw overrides.nativeError;
      return { uri: 'content://media/external/images/media/1' };
    },
  };
  const permissionsAndroid = {
    PERMISSIONS: { WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE' },
    RESULTS: { GRANTED: 'granted' },
    check: async (permission) => {
      calls.push(['checkWrite', permission]);
      return overrides.legacyGranted ?? false;
    },
    request: async (permission) => {
      calls.push(['requestWrite', permission]);
      return overrides.legacyRequest ?? 'denied';
    },
  };
  const mocks = {
    'expo-file-system/legacy': {},
    'expo-media-library': mediaLibrary,
    'react-native': { Platform: { OS: os, Version: version }, PermissionsAndroid: permissionsAndroid },
    '../modules/expo-project-albums': nativeAlbums,
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (name) => {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected import: ${name}`);
      return mocks[name];
    },
  });
  return { save: module.exports.savePhotoToProjectAlbum, calls };
}

test('Android 10+ saves to the named album without any library/storage permission calls', async () => {
  for (const version of [29, 30, 32, 33, 35]) {
    const { save, calls } = storageFixture('android', version);
    assert.equal((await save('file:///private/frame.jpg', ' Puppy ', 'project-123456', false)).saved, true);
    assert.equal(JSON.stringify(calls), JSON.stringify([
      ['nativeSave', { uri: 'file:///private/frame.jpg', albumName: 'MyLifelens - Puppy' }],
    ]));
  }
});

test('duplicate names keep separate project-album suffixes', async () => {
  const { save, calls } = storageFixture('android');
  await save('file:///private/frame.jpg', 'Puppy', 'project-123456', true);
  assert.equal(calls[0][1].albumName, 'MyLifelens - Puppy (123456)');
});

test('legacy Android denial does not attempt a Gallery write or ask for read access', async () => {
  const { save, calls } = storageFixture('android', 28);
  assert.equal((await save('file:///private/frame.jpg', 'Puppy', 'project', false)).saved, false);
  assert.equal(JSON.stringify(calls), JSON.stringify([
    ['checkWrite', 'android.permission.WRITE_EXTERNAL_STORAGE'],
    ['requestWrite', 'android.permission.WRITE_EXTERNAL_STORAGE'],
  ]));
});

test('legacy Android saves after write permission is granted', async () => {
  for (const overrides of [{ legacyGranted: true }, { legacyRequest: 'granted' }]) {
    const { save, calls } = storageFixture('android', 24, overrides);
    assert.equal((await save('file:///private/frame.jpg', 'Puppy', 'project', false)).saved, true);
    assert.equal(calls.at(-1)[0], 'nativeSave');
    assert.ok(calls.every(([name]) => !['getPermissions', 'requestPermissions', 'getAlbum'].includes(name)));
  }
});

test('native failures propagate instead of reporting a successful Gallery copy', async () => {
  const { save } = storageFixture('android', 35, { nativeError: new Error('Write failed') });
  await assert.rejects(save('file:///private/frame.jpg', 'Puppy', 'project', false), /Write failed/);
});

test('iOS keeps its existing permission and new-album creation flow', async () => {
  const { save, calls } = storageFixture('ios');
  assert.equal((await save('file:///private/frame.jpg', 'Puppy', 'project', false)).saved, true);
  assert.equal(JSON.stringify(calls), JSON.stringify([
    ['getPermissions', false, ['photo']],
    ['getAlbum', 'MyLifelens - Puppy'],
    ['createAlbum', 'MyLifelens - Puppy', undefined, false, 'file:///private/frame.jpg'],
  ]));
});

test('iOS adds to an existing album and handles denied Photos permission', async () => {
  const existing = storageFixture('ios', 26, { existingAlbum: { id: 'album' } });
  await existing.save('file:///private/frame.jpg', 'Puppy', 'project', false);
  assert.equal(existing.calls.at(-1)[0], 'createAsset');
  const denied = storageFixture('ios', 26, { iosGranted: false, iosRequestGranted: false });
  assert.equal((await denied.save('file:///private/frame.jpg', 'Puppy', 'project', false)).saved, false);
  assert.equal(denied.calls.length, 2);
});

test('web never invokes native album or permission APIs', async () => {
  const { save, calls } = storageFixture('web');
  assert.equal((await save('blob:frame', 'Puppy', 'project', false)).saved, false);
  assert.equal(calls.length, 0);
});