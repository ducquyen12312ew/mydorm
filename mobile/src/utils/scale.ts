import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export const sw = (size: number) => (width / BASE_WIDTH) * size;
export const sh = (size: number) => (height / BASE_HEIGHT) * size;

export const sf = (size: number) => {
  const scale = width / BASE_WIDTH;
  const newSize = scale * size;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export const isSmallScreen = width < 375;
export const isLargeScreen = width > 414;
export const screenWidth = width;
export const screenHeight = height;
