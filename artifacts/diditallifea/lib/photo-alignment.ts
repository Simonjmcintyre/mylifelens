export type PhotoAlignment = {
  x: number;
  y: number;
  scale?: number;
};

export const PHOTO_ALIGNMENT_ASPECT_RATIO = 0.92;

export function getCumulativePhotoAlignments(
  photos: Array<{ alignmentOffset?: PhotoAlignment }>,
) {
  let x = 0;
  let y = 0;
  let scale = 1;

  return photos.map((photo, index) => {
    if (index > 0 && photo.alignmentOffset) {
      x += photo.alignmentOffset.x * scale;
      y += photo.alignmentOffset.y * scale;
      scale *= photo.alignmentOffset.scale ?? 1;
    }

    return { x, y, scale };
  });
}