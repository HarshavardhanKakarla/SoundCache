import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { formatDistance } from '../utils/distance';

export default function CapsuleCard({ capsule, onSelect, onWalkCloser }) {
  const isUnlocked = capsule.isUnlocked;

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'Secret':
        return '#F472B6';
      case 'Music':
        return '#38BDF8';
      case 'Whisper':
        return '#34D399';
      case 'History':
        return '#FBBF24';
      default:
        return '#A78BFA';
    }
  };

  const catColor = getCategoryColor(capsule.category);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.card,
        isUnlocked ? styles.cardUnlocked : styles.cardLocked,
      ]}
      onPress={() => onSelect(capsule)}
    >
      <View style={styles.cardHeader}>
        {/* Category Pill */}
        <View style={[styles.categoryBadge, { borderColor: catColor + '40' }]}>
          <Text style={[styles.categoryText, { color: catColor }]}>
            {capsule.category || 'Story'}
          </Text>
        </View>

        {/* Lock Status & Distance */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isUnlocked ? '#00F5A020' : '#FF4B5C20' },
          ]}
        >
          <Ionicons
            name={isUnlocked ? 'lock-open' : 'lock-closed'}
            size={13}
            color={isUnlocked ? COLORS.accent : COLORS.danger}
          />
          <Text
            style={[
              styles.statusText,
              { color: isUnlocked ? COLORS.accent : COLORS.danger },
            ]}
          >
            {isUnlocked ? 'UNLOCKED' : formatDistance(capsule.distanceMeters)}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={1}>
        {capsule.title}
      </Text>

      {/* Description or hint */}
      <Text style={styles.description} numberOfLines={2}>
        {isUnlocked
          ? capsule.description || 'Audio ready to listen.'
          : `🔒 Geo-locked capsule. Move ${Math.max(
              0,
              (capsule.distanceMeters || 45) - 30
            )}m closer to decode audio.`}
      </Text>

      {/* Footer Info */}
      <View style={styles.cardFooter}>
        <View style={styles.authorGroup}>
          <Ionicons name="person-circle-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.authorText}>{capsule.author || 'Anonymous'}</Text>
          <Text style={styles.dot}>•</Text>
          <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.durationText}>{capsule.duration || 20}s</Text>
        </View>

        {isUnlocked ? (
          <View style={styles.playAction}>
            <Text style={styles.playActionText}>Listen</Text>
            <Ionicons name="play" size={12} color="#090D16" />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.walkCloserAction}
            onPress={() => onWalkCloser && onWalkCloser(capsule)}
          >
            <Ionicons name="footsteps-outline" size={12} color={COLORS.primary} />
            <Text style={styles.walkCloserText}>Walk Closer</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.2,
  },
  cardUnlocked: {
    borderColor: '#00F5A060',
    backgroundColor: '#0e1a22',
  },
  cardLocked: {
    borderColor: COLORS.cardBorder,
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  categoryText: {
    fontSize: 11,
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
    color: COLORS.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  dot: {
    color: COLORS.textDim,
    marginHorizontal: 3,
  },
  durationText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  playAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  playActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#090D16',
  },
  walkCloserAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  walkCloserText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

