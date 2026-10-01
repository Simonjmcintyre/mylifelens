import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { PermissionsAndroid, Platform } from 'react-native';
import ProjectAlbums from '../modules/expo-project-albums';

const PHOTO_DIRECTORY = 'project-photos';

export async function storeProjectPhoto(uri: string, projectId: string, fileName?: string | null) {
  if (Platform.OS === 'web') return uri;
  if (!FileSystem.documentDirectory) throw new Error('Local photo storage is unavailable.');

  const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const directory = `${FileSystem.documentDirectory}${PHOTO_DIRECTORY}/${safeProjectId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = (
    uri.match(/\.(jpe?g|png|heic|webp)(?:[?#]|$)/i)?.[1] ??
    fileName?.match(/\.(jpe?g|png|heic|webp)$/i)?.[1] ??
    'jpg'
  ).toLowerCase();
  const destination = `${directory}${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

// iOS may change the app container's absolute path after an update.
export function normalizeStoredPhotoUri(uri: string) {
  if (!FileSystem.documentDirectory) return uri;
  const marker = `/${PHOTO_DIRECTORY}/`;
  const markerIndex = uri.indexOf(marker);
  return markerIndex === -1
    ? uri
    : `${FileSystem.documentDirectory}${PHOTO_DIRECTORY}/${uri.slice(markerIndex + marker.length)}`;
}

export async function removeStoredProjectPhoto(uri: string) {
  if (!FileSystem.documentDirectory || !uri.startsWith(`${FileSystem.documentDirectory}${PHOTO_DIRECTORY}/`)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function removeStoredProjectPhotos(projectId: string) {
  if (!FileSystem.documentDirectory) return;
  const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  await FileSystem.deleteAsync(
    `${FileSystem.documentDirectory}${PHOTO_DIRECTORY}/${safeProjectId}/`,
    { idempotent: true },
  );
}

export async function savePhotoToProjectAlbum(
  uri: string,
  projectName: string,
  projectId: string,
  duplicateProjectName: boolean,
) {
  if (Platform.OS === 'web') return { saved: false, reason: 'Phone albums are not available in a browser.' };

  const name = projectName.trim() || 'Project';
  const albumName = `MyLifelens - ${name}${duplicateProjectName ? ` (${projectId.slice(-6)})` : ''}`;

  if (Platform.OS === 'android') {
    // Scoped MediaStore writes need no storage permission on Android 10+.
    // Older phones need write-only permission, never broad library reads.
    if (Number(Platform.Version) < 29) {
      const writePermission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
      const alreadyGranted = await PermissionsAndroid.check(writePermission);
      if (!alreadyGranted) {
        const permission = await PermissionsAndroid.request(writePermission, {
          title: 'Save project photos',
          message: 'Allow MyLifelens to save camera photos into your Gallery project albums. The app does not browse your photo library.',
          buttonPositive: 'Continue',
          buttonNegative: 'Not now',
        });
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          return {
            saved: false,
            reason: 'Allow storage saving for MyLifelens in your phone settings to save future camera photos to a Gallery project album.',
          };
        }
      }
    }
    await ProjectAlbums.savePhotoToAlbum({ uri, albumName });
    return { saved: true };
  }

  // Keep the existing iOS Photos album and permission behaviour.
  let permission = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  if (!permission.granted) {
    permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  }
  if (!permission.granted) {
    return {
      saved: false,
      reason: 'Allow MyLifelens access to Photos/Gallery in your phone settings to save future photos to a project album.',
    };
  }

  const album = await MediaLibrary.getAlbumAsync(albumName);
  if (album) {
    await MediaLibrary.createAssetAsync(uri, album);
  } else {
    // Create the album with its first photo: Android does not support empty albums.
    await MediaLibrary.createAlbumAsync(albumName, undefined, false, uri);
  }
  return { saved: true };
}