import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

export type AppIconName =
  | 'alert-circle'
  | 'aperture'
  | 'arrow-down-right'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up-right'
  | 'bell'
  | 'bell-off'
  | 'camera'
  | 'check'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'edit-3'
  | 'film'
  | 'flag'
  | 'home'
  | 'image'
  | 'layers'
  | 'minus'
  | 'move'
  | 'pause'
  | 'play'
  | 'plus'
  | 'rotate-ccw'
  | 'share-2'
  | 'sun'
  | 'upload'
  | 'x';

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function IconDrawing({ name }: { name: AppIconName }) {
  switch (name) {
    case 'alert-circle':
      return <><Circle cx="12" cy="12" r="10" /><Line x1="12" y1="8" x2="12" y2="12" /><Line x1="12" y1="16" x2="12.01" y2="16" /></>;
    case 'aperture':
      return <><Circle cx="12" cy="12" r="10" /><Path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" /></>;
    case 'arrow-down-right':
      return <><Line x1="7" y1="7" x2="17" y2="17" /><Polyline points="17 7 17 17 7 17" /></>;
    case 'arrow-left':
      return <><Line x1="19" y1="12" x2="5" y2="12" /><Polyline points="12 19 5 12 12 5" /></>;
    case 'arrow-right':
      return <><Line x1="5" y1="12" x2="19" y2="12" /><Polyline points="12 5 19 12 12 19" /></>;
    case 'arrow-up-right':
      return <><Line x1="7" y1="17" x2="17" y2="7" /><Polyline points="7 7 17 7 17 17" /></>;
    case 'bell':
      return <><Path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><Path d="M13.73 21a2 2 0 01-3.46 0" /></>;
    case 'bell-off':
      return <><Path d="M13.73 21a2 2 0 01-3.46 0M18.63 18H3c0-2 3-2 3-9 0-.65.1-1.27.29-1.85M8.56 3.64A6 6 0 0118 8c0 2.1.27 3.54.69 4.56" /><Line x1="2" y1="2" x2="22" y2="22" /></>;
    case 'camera':
      return <><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><Circle cx="12" cy="13" r="4" /></>;
    case 'check':
      return <Polyline points="20 6 9 17 4 12" />;
    case 'check-circle':
      return <><Path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><Polyline points="22 4 12 14.01 9 11.01" /></>;
    case 'chevron-down':
      return <Polyline points="6 9 12 15 18 9" />;
    case 'chevron-left':
      return <Polyline points="15 18 9 12 15 6" />;
    case 'chevron-right':
      return <Polyline points="9 18 15 12 9 6" />;
    case 'chevron-up':
      return <Polyline points="18 15 12 9 6 15" />;
    case 'edit-3':
      return <><Path d="M12 20h9" /><Path d="M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4z" /></>;
    case 'film':
      return <><Rect x="2" y="2" width="20" height="20" rx="2" /><Line x1="7" y1="2" x2="7" y2="22" /><Line x1="17" y1="2" x2="17" y2="22" /><Line x1="2" y1="12" x2="22" y2="12" /><Line x1="2" y1="7" x2="7" y2="7" /><Line x1="2" y1="17" x2="7" y2="17" /><Line x1="17" y1="17" x2="22" y2="17" /><Line x1="17" y1="7" x2="22" y2="7" /></>;
    case 'flag':
      return <><Path d="M5 22V4" /><Path d="M5 4h12l-2 4 2 4H5" /></>;
    case 'home':
      return <><Path d="M3 11l9-8 9 8" /><Path d="M5 10v11h14V10M9 21v-7h6v7" /></>;
    case 'image':
      return <><Rect x="3" y="3" width="18" height="18" rx="2" /><Circle cx="8.5" cy="8.5" r="1.5" /><Polyline points="21 15 16 10 5 21" /></>;
    case 'layers':
      return <><Polygon points="12 2 2 7 12 12 22 7 12 2" /><Polyline points="2 12 12 17 22 12" /><Polyline points="2 17 12 22 22 17" /></>;
    case 'minus':
      return <Line x1="5" y1="12" x2="19" y2="12" />;
    case 'move':
      return <><Polyline points="5 9 2 12 5 15" /><Polyline points="9 5 12 2 15 5" /><Polyline points="15 19 12 22 9 19" /><Polyline points="19 9 22 12 19 15" /><Line x1="2" y1="12" x2="22" y2="12" /><Line x1="12" y1="2" x2="12" y2="22" /></>;
    case 'pause':
      return <><Rect x="6" y="4" width="4" height="16" /><Rect x="14" y="4" width="4" height="16" /></>;
    case 'play':
      return <Polygon points="5 3 19 12 5 21 5 3" />;
    case 'plus':
      return <><Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" /></>;
    case 'rotate-ccw':
      return <><Polyline points="1 4 1 10 7 10" /><Path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></>;
    case 'share-2':
      return <><Circle cx="18" cy="5" r="3" /><Circle cx="6" cy="12" r="3" /><Circle cx="18" cy="19" r="3" /><Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>;
    case 'sun':
      return <><Circle cx="12" cy="12" r="4" /><Path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" /></>;
    case 'upload':
      return <><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><Polyline points="17 8 12 3 7 8" /><Line x1="12" y1="3" x2="12" y2="15" /></>;
    case 'x':
      return <><Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" /></>;
  }
}

export function AppIcon({ name, size = 24, color = '#000', strokeWidth = 2 }: AppIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <IconDrawing name={name} />
    </Svg>
  );
}