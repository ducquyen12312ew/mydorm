import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  iconName?: IoniconsName;
  // Legacy emoji fallback — prefer iconName
  icon?: string;
}

export function EmptyState({ title, subtitle, iconName = 'file-tray-outline', icon }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? (
        <Text style={styles.emoji}>{icon}</Text>
      ) : (
        <View style={styles.iconBox}>
          <Ionicons name={iconName} size={40} color={Colors.textMuted} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, flex: 1 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emoji: { fontSize: 44, marginBottom: Spacing.md },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
