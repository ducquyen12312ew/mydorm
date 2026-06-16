import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/spacing';
import { sf } from '../../utils/scale';
import { statusLabel } from '../../utils/format';

type BadgeVariant = 'pending' | 'approved' | 'rejected' | 'waitlist' | 'active' | 'inactive' | 'info';

interface BadgeProps {
  status: BadgeVariant | string;
  label?: string;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  pending: { bg: Colors.warningLight, text: Colors.warning },
  approved: { bg: Colors.successLight, text: Colors.success },
  rejected: { bg: Colors.errorLight, text: Colors.error },
  waitlist: { bg: '#f3e8ff', text: Colors.statusWaitlist },
  active: { bg: Colors.successLight, text: Colors.success },
  inactive: { bg: Colors.surfaceAlt, text: Colors.textSecondary },
  info: { bg: Colors.infoLight, text: Colors.info },
};

export function Badge({ status, label }: BadgeProps) {
  const colors = variantColors[status as BadgeVariant] ?? variantColors.info;
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label ?? statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: sf(12),
    fontWeight: '600',
  },
});
