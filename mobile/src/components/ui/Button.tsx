import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius, Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { haptic } from '../../utils/haptics';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticFeedback?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  hapticFeedback = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (hapticFeedback) haptic.light();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.textInverse}
        />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}`], styles[`labelSize_${size}`], textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.45 },

  size_sm: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, minHeight: 34 },
  size_md: { paddingVertical: 11, paddingHorizontal: Spacing.md, minHeight: 46 },
  size_lg: { paddingVertical: 15, paddingHorizontal: Spacing.lg, minHeight: 54 },

  variant_primary: { backgroundColor: Colors.primary },
  variant_secondary: { backgroundColor: Colors.surfaceAlt },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  variant_danger: { backgroundColor: Colors.error },
  variant_ghost: { backgroundColor: 'transparent' },

  label: { fontWeight: FontWeight.semibold, letterSpacing: 0.1 },
  label_primary: { color: Colors.textInverse },
  label_secondary: { color: Colors.text },
  label_outline: { color: Colors.primary },
  label_danger: { color: Colors.textInverse },
  label_ghost: { color: Colors.primary },

  labelSize_sm: { fontSize: FontSize.sm },
  labelSize_md: { fontSize: FontSize.base },
  labelSize_lg: { fontSize: FontSize.lg },
});
