import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../utils/constants';
import { likeCapsuleApi, recordListenApi } from '../utils/api';

export default function CapsulePlayerModal({ visible, capsule, onClose }) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(1);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);

  // Frequency wave animation bars
  const waveBars = useRef(
    Array.from({ length: 16 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (capsule) {
      setLikes(capsule.likes || 0);
      setHasLiked(false);
      loadAndPlayAudio();
      recordListenApi(capsule._id);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
    }

    return () => {
      unloadAudio();
    };
  }, [capsule]);

  // Animate soundwave bars while playing
  useEffect(() => {
    let animLoop;
    if (isPlaying) {
      const animations = waveBars.map((bar) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(bar, {
              toValue: Math.random() * 0.8 + 0.2,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
            Animated.timing(bar, {
              toValue: Math.random() * 0.3 + 0.1,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
          ])
        )
      );
      animLoop = Animated.parallel(animations);
      animLoop.start();
    } else {
      waveBars.forEach((bar) => bar.setValue(0.2));
    }

    return () => {
      if (animLoop) animLoop.stop();
    };
  }, [isPlaying]);

  async function loadAndPlayAudio() {
    if (!capsule || !capsule.audioUrl) {
      setPlaybackError('Audio stream unavailable for this capsule.');
      return;
    }

    try {
      setPlaybackError(null);
      setIsLoading(true);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: capsule.audioUrl },
        { shouldPlay: true, volume: 1.0 },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
      setIsLoading(false);
    } catch (err) {
      console.warn('Audio playback error:', err?.message);
      setPlaybackError('Unable to play audio. Tap play to retry.');
      setIsLoading(false);
    }
  }

  function onPlaybackStatusUpdate(status) {
    if (status.isLoaded) {
      setPositionMillis(status.positionMillis);
      setDurationMillis(status.durationMillis || (capsule?.duration || 20) * 1000);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPositionMillis(0);
      }
    }
  }

  async function unloadAudio() {
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (e) {}
      setSound(null);
    }
    setIsPlaying(false);
  }

  async function togglePlayPause() {
    if (!sound) {
      await loadAndPlayAudio();
      return;
    }
    try {
      if (isPlaying) {
        await sound.pauseAsync();
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {}
      } else {
        await sound.playAsync();
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Play/pause error:', err);
    }
  }

  async function handleLike() {
    if (hasLiked || !capsule) return;
    setHasLiked(true);
    setLikes((prev) => prev + 1);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}
    await likeCapsuleApi(capsule._id);
  }

  function handleClose() {
    unloadAudio();
    onClose();
  }

  if (!capsule) return null;

  const progressPercent = Math.min(
    100,
    Math.round((positionMillis / Math.max(durationMillis, 1)) * 100)
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={styles.unlockedBadge}>
                <Ionicons name="radio" size={12} color={COLORS.accent} />
                <Text style={styles.unlockedBadgeText}>UNLOCKED FREQUENCY</Text>
              </View>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>{capsule.category}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Title & Author */}
          <Text style={styles.title}>{capsule.title}</Text>
          <Text style={styles.author}>
            Recorded by <Text style={styles.authorHighlight}>{capsule.author}</Text>
          </Text>

          {/* Soundwave Visualizer Bars */}
          <View style={styles.waveContainer}>
            {waveBars.map((bar, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    transform: [{ scaleY: bar }],
                    backgroundColor: isPlaying ? COLORS.primary : COLORS.cardBorder,
                  },
                ]}
              />
            ))}
          </View>

          {/* Progress Timeline */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%` },
                ]}
              />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>
                {Math.floor(positionMillis / 1000)}s
              </Text>
              <Text style={styles.timeText}>
                {Math.ceil(durationMillis / 1000)}s
              </Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controlsRow}>
            {/* Like Button */}
            <TouchableOpacity
              style={[
                styles.iconBtn,
                hasLiked && { backgroundColor: 'rgba(255, 75, 92, 0.15)' },
              ]}
              onPress={handleLike}
            >
              <Ionicons
                name={hasLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={hasLiked ? COLORS.danger : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.btnLabel,
                  hasLiked && { color: COLORS.danger, fontWeight: '700' },
                ]}
              >
                {likes}
              </Text>
            </TouchableOpacity>

            {/* Main Play/Pause Button */}
            <TouchableOpacity
              style={styles.playButton}
              onPress={togglePlayPause}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#090D16" />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={28}
                  color="#090D16"
                  style={{ marginLeft: isPlaying ? 0 : 3 }}
                />
              )}
            </TouchableOpacity>

            {/* Listens Count */}
            <View style={styles.iconBtn}>
              <Ionicons name="headset-outline" size={22} color={COLORS.textMuted} />
              <Text style={styles.btnLabel}>{capsule.listens || 0}</Text>
            </View>
          </View>

          {/* Location footnote */}
          {playbackError ? (
            <View style={styles.geoFooter}>
              <Ionicons name="alert-circle" size={13} color={COLORS.danger} />
              <Text style={[styles.geoFooterText, { color: COLORS.danger }]}>
                {playbackError}
              </Text>
            </View>
          ) : (
            <View style={styles.geoFooter}>
              <Ionicons name="shield-checkmark" size={13} color={COLORS.accent} />
              <Text style={styles.geoFooterText}>
                Unlocked within 30m proximity zone
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 13, 0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0F1523',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  unlockedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  categoryPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  author: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  authorHighlight: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    marginVertical: 12,
    paddingHorizontal: 10,
  },
  waveBar: {
    width: 6,
    height: 48,
    borderRadius: 3,
  },
  progressContainer: {
    marginVertical: 10,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.textDim,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
    marginBottom: 10,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.card,
  },
  btnLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  geoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 4,
  },
  geoFooterText: {
    fontSize: 11,
    color: COLORS.textDim,
    textAlign: 'center',
  },
});

