import { requireOptionalNativeModule } from 'expo-modules-core';

export type SavePhotoToAlbumOptions = {
  uri: string;
  albumName: string;
};

type ExpoProjectAlbumsModule = {
  savePhotoToAlbum(options: SavePhotoToAlbumOptions): Promise<{ uri: string }>;
};

const nativeModule = requireOptionalNativeModule<ExpoProjectAlbumsModule>('ExpoProjectAlbums');

const unavailableModule: ExpoProjectAlbumsModule = {
  async savePhotoToAlbum() {
    throw new Error(
      'Saving photos to project albums is available in installed MyLifelens builds, not Expo Go or older builds.',
    );
  },
};

export default nativeModule ?? unavailableModule;