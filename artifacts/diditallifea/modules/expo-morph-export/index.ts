import { requireOptionalNativeModule } from 'expo-modules-core';

export type MorphExportFrame = {
  uri: string;
  x: number;
  y: number;
  scale: number;
};

export type MorphExportOptions = {
  frames: MorphExportFrame[];
  width: number;
  height: number;
  fps?: number;
  speed?: number;
  holdSeconds?: number;
  transitionSeconds?: number;
};

type MorphExportModuleType = {
  exportMorph(options: MorphExportOptions): Promise<{ uri: string; duration: number }>;
};

const nativeModule = requireOptionalNativeModule<MorphExportModuleType>('ExpoMorphExport');

const unavailableModule: MorphExportModuleType = {
  async exportMorph() {
    throw new Error('Morph video export is available in installed MyLifelens builds, not Expo Go.');
  },
};

export default nativeModule ?? unavailableModule;