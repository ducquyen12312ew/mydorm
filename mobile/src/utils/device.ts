import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getDeviceId(): string {
  return (
    Constants.sessionId ||
    Constants.installationId ||
    `device-${Platform.OS}-${Date.now()}`
  );
}

export function getFingerprint(): string {
  const platform = Platform.OS;
  const version = Platform.Version;
  const model = Constants.deviceName || 'unknown';
  return `${model}|${platform}|${version}`;
}
