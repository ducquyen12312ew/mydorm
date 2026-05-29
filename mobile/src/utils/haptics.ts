import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const noop = () => Promise.resolve();
const isNative = Platform.OS !== 'web';

export const haptic = {
  light: isNative ? () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : noop,
  medium: isNative ? () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) : noop,
  heavy: isNative ? () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy) : noop,
  success: isNative ? () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : noop,
  warning: isNative ? () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning) : noop,
  error: isNative ? () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error) : noop,
  selection: isNative ? () => Haptics.selectionAsync() : noop,
};
