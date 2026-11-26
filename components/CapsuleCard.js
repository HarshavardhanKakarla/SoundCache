import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../utils/theme';
import { CATEGORIES } from '../utils/constants';
import { formatDistance } from '../utils/distance';

export default function CapsuleCard({ capsule, onSelect }) {
  const { theme } = useTheme();
  const isUnlocked = capsule.isUnlocked;

  const catObj = CATEGORIES.find((c) => c.id === capsule.category);
  const catColor = catObj?.color || theme.primary;
  const replyCount = capsule.replyCount ?? (capsule.replies?.length || 0);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.card,
        {
          backgroundColor: isUnlocked ? theme.unlockedCardBg : theme.surface,
          borderColor: isUnlocked ? theme.unlockedCardBorder : theme.border,
        },
      ]}
      onPress={() => onSelect(capsule)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.categoryBadge, { borderColor: catColor + '45' }]}>
          <Text style={[styles.categoryText, { color: catColor }]}>
            {capsule.category || 'Story'}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isUnlocked ? theme.accentSoft : theme.dangerSoft },
          ]}
        >
          <Ionicons
            name={isUnlocked ? 'lock-open' : 'lock-closed'}
            size={12}
            color={isUnlocked ? theme.accent : theme.danger}
          />
          <Text
            style={[
              styles.statusText,
              { color: isUnlocked ? theme.accent : theme.danger },
            ]}
          >
            {isUnlocked ? 'UNLOCKED' : formatDistance(capsule.distanceMeters)}
          </Text>
        </View>
      </View>

      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
        {capsule.title}
      </Text>

      <Text style={[styles.description, { color: theme.textMuted }]} numberOfLines={2}>
        {isUnlocked
          ? capsule.description || 'Audio ready to listen. Tap to open player & guestbook.'
          : `Geo-locked capsule. Move ${Math.max(
              0,
              (capsule.distanceMeters || 45) - 30
            )}m closer to decode audio.`}
      </Text>

      <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
        <View style={styles.authorGroup}>
          <Ionicons name="person-circle-outline" size={14} color={theme.textMuted} />
          <Text style={[styles.authorText, { color: theme.textMuted }]}>
            {capsule.author || 'Anonymous'}
          </Text>
          <Text style={[styles.dot, { color: theme.textDim }]}>•</Text>
          <Ionicons name="time-outline" size={13} color={theme.textMuted} />
          <Text style={[styles.durationText, { color: theme.textMuted }]}>
            {capsule.duration || 15}s
          </Text>
          {replyCount > 0 && (
            <>
              <Text style={[styles.dot, { color: theme.textDim }]}>•</Text>
              <Ionicons name="chatbubbles-outline" size={12} color={theme.primary} />
              <Text style={[styles.durationText, { color: theme.primary, fontWeight: '600' }]}>
                {replyCount}
              </Text>
            </>
          )}
        </View>

        {isUnlocked ? (
          <View style={[styles.playAction, { backgroundColor: theme.accent }]}>
            <Text style={[styles.playActionText, { color: theme.primaryText }]}>Listen</Text>
            <Ionicons name="play" size={11} color={theme.primaryText} />
          </View>
        ) : (
          <View
            style={[
              styles.lockedAction,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}
          >
            <Ionicons name="lock-closed-outline" size={11} color={theme.textMuted} />
            <Text style={[styles.lockedActionText, { color: theme.textMuted }]}>
              Within 30m
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  authorText: {
    fontSize: 12,
  },
  dot: {
    marginHorizontal: 2,
  },
  durationText: {
    fontSize: 12,
  },
  playAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  playActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lockedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  lockedActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
