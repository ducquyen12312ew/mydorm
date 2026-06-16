import { sf } from '../utils/scale';

export const FontSize = {
  xs: sf(11),
  sm: sf(13),
  base: sf(15),
  md: sf(15),
  lg: sf(17),
  xl: sf(20),
  xxl: sf(24),
  display: sf(30),
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Typography = {
  displayBold: { fontSize: FontSize.display, fontWeight: FontWeight.extrabold },
  titleLarge: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  titleMedium: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  titleSmall: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  bodyLarge: { fontSize: FontSize.base, fontWeight: FontWeight.regular },
  bodyMedium: { fontSize: FontSize.sm, fontWeight: FontWeight.regular },
  bodySmall: { fontSize: FontSize.xs, fontWeight: FontWeight.regular },
  labelLarge: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  labelMedium: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  labelSmall: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  caption: { fontSize: FontSize.xs, fontWeight: FontWeight.regular },
  button: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  buttonSm: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
} as const;
