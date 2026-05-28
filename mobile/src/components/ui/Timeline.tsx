import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { formatDateTime } from '../../utils/format';

export type TimelineState = 'done' | 'active' | 'error' | 'pending' | 'cancelled';

export interface TimelineItem {
  key: string;
  label: string;
  sublabel?: string;
  timestamp?: string | null;
  state: TimelineState;
  icon: string;
}

const STATE_COLOR: Record<TimelineState, string> = {
  done: Colors.success,
  active: Colors.primary,
  error: Colors.error,
  pending: Colors.border,
  cancelled: Colors.textMuted,
};

const STATE_BG: Record<TimelineState, string> = {
  done: Colors.successLight,
  active: Colors.primaryLight,
  error: Colors.errorLight,
  pending: Colors.surfaceAlt,
  cancelled: Colors.surfaceAlt,
};

const STATE_LABEL: Partial<Record<TimelineState, string>> = {
  active: 'Hiện tại',
  error: 'Từ chối',
  cancelled: 'Đã hủy',
};

function TimelineNode({ item, isLast }: { item: TimelineItem; isLast: boolean }) {
  const color = STATE_COLOR[item.state];
  const bg = STATE_BG[item.state];
  const pill = STATE_LABEL[item.state];

  return (
    <View style={styles.row}>
      <View style={styles.leftCol}>
        <View style={[styles.circle, { backgroundColor: bg, borderColor: color }]}>
          <Ionicons name={item.icon as any} size={16} color={color} />
        </View>
        {!isLast && (
          <View style={[styles.connector, { backgroundColor: item.state === 'done' ? Colors.success : Colors.border }]} />
        )}
      </View>

      <View style={[styles.content, !isLast && styles.contentGap]}>
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.label,
              item.state === 'active' && { color: Colors.primary },
              (item.state === 'pending' || item.state === 'cancelled') && { color: Colors.textMuted },
            ]}
          >
            {item.label}
          </Text>
          {pill && (
            <View
              style={[
                styles.pill,
                item.state === 'error' || item.state === 'cancelled'
                  ? { backgroundColor: Colors.errorLight }
                  : { backgroundColor: Colors.primaryLight },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  item.state === 'error' || item.state === 'cancelled'
                    ? { color: Colors.error }
                    : { color: Colors.primary },
                ]}
              >
                {pill}
              </Text>
            </View>
          )}
        </View>

        {item.sublabel ? (
          <Text
            style={[
              styles.sublabel,
              item.state === 'active' && { color: Colors.primary + 'cc' },
              item.state === 'pending' && { color: Colors.textMuted },
            ]}
          >
            {item.sublabel}
          </Text>
        ) : null}

        {item.timestamp ? (
          <Text style={styles.timestamp}>{formatDateTime(item.timestamp)}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function Timeline({ items, style }: { items: TimelineItem[]; style?: ViewStyle }) {
  return (
    <View style={style}>
      {items.map((item, i) => (
        <TimelineNode key={item.key} item={item} isLast={i === items.length - 1} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  leftCol: { alignItems: 'center', width: 40 },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  connector: { width: 2, flex: 1, minHeight: 12, marginVertical: 3 },

  content: { flex: 1, paddingTop: 9 },
  contentGap: { paddingBottom: 18 },

  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, flex: 1 },

  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  pillText: { fontSize: 9, fontWeight: FontWeight.bold },

  sublabel: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17, marginBottom: 2 },
  timestamp: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
