import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../utils/theme';
import { likeCapsuleApi, recordListenApi, addCapsuleReplyApi } from '../utils/api';

const MAX_REPLY_SECONDS = 10;

export default function CapsulePlayerModal({ visible, capsule, onClose }) {
  const { theme } = useTheme();
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(1);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);

  // Whisper Chain (10s Guestbook Replies)
  const [replies, setReplies] = useState([]);
  const [playingReplyId, setPlayingReplyId] = useState(null);
  const [replySound, setReplySound] = useState(null);
  const [replyRecording, setReplyRecording] = useState(null);
  const [isRecordingReply, setIsRecordingReply] = useState(false);
  const [replySeconds, setReplySeconds] = useState(0);
  const [replyAudioUri, setReplyAudioUri] = useState(null);
  const [replyAuthor, setReplyAuthor] = useState('');
  const [isPostingReply, setIsPostingReply] = useState(false);

  const replyTimerRef = useRef(null);
  const waveBars = useRef(
    Array.from({ length: 16 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (capsule) {
      setLikes(capsule.likes || 0);
      setHasLiked(false);
      setReplies(capsule.replies || []);
      setReplyAudioUri(null);
      setReplySeconds(0);
      setPlayingReplyId(null);
      loadAndPlayAudio();
      recordListenApi(capsule._id);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
    }

    return () => {
      unloadAllAudio();
    };
  }, [capsule]);

  useEffect(() => {
    let animLoop;
    if (isPlaying) {
      const animations = waveBars.map((bar) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(bar, {
              toValue: Math.random() * 0.75 + 0.25,
              duration: 220 + Math.random() * 280,
              useNativeDriver: true,
            }),
            Animated.timing(bar, {
              toValue: Math.random() * 0.25 + 0.1,
              duration: 220 + Math.random() * 280,
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

  async function unloadAllAudio() {
    if (replyTimerRef.current) clearInterval(replyTimerRef.current);
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (e) {}
      setSound(null);
    }
    if (replySound) {
      try {
        await replySound.unloadAsync();
      } catch (e) {}
      setReplySound(null);
    }
    if (replyRecording) {
      try {
        await replyRecording.stopAndUnloadAsync();
      } catch (e) {}
      setReplyRecording(null);
    }
    setIsPlaying(false);
    setPlayingReplyId(null);
    setIsRecordingReply(false);
  }

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
      setDurationMillis(status.durationMillis || (capsule?.duration || 15) * 1000);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPositionMillis(0);
      }
    }
  }

  async function togglePlayPause() {
    if (replySound && playingReplyId) {
      await replySound.pauseAsync();
      setPlayingReplyId(null);
    }

    if (!sound) {
      await loadAndPlayAudio();
      return;
    }
    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
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

  // ---- Whisper Chain 10s Reply Recorder ----
  async function startReplyRecording() {
    try {
      if (sound && isPlaying) await sound.pauseAsync();
      if (replySound) {
        await replySound.unloadAsync();
        setReplySound(null);
        setPlayingReplyId(null);
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Needed', 'Microphone access is required to record a whisper reply.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setReplyAudioUri(null);
      setReplySeconds(0);

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setReplyRecording(rec);
      setIsRecordingReply(true);

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {}

      replyTimerRef.current = setInterval(() => {
        setReplySeconds((prev) => {
          if (prev >= MAX_REPLY_SECONDS - 1) {
            stopReplyRecording(rec);
            return MAX_REPLY_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setIsRecordingReply(false);
      Alert.alert('Recording Error', 'Could not start microphone recording.');
    }
  }

  async function stopReplyRecording(activeRec = replyRecording) {
    if (!activeRec) return;
    try {
      if (replyTimerRef.current) clearInterval(replyTimerRef.current);
      setIsRecordingReply(false);
      await activeRec.stopAndUnloadAsync();
      const uri = activeRec.getURI();
      setReplyAudioUri(uri);
      setReplyRecording(null);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
    } catch (err) {
      console.warn('Stop reply error:', err);
    }
  }

  async function handlePostReply() {
    if (!replyAudioUri || !capsule) return;
    try {
      setIsPostingReply(true);
      const savedReply = await addCapsuleReplyApi({
        capsuleId: capsule._id,
        author: replyAuthor.trim() || 'Anonymous Explorer',
        duration: replySeconds || 1,
        audioUri: replyAudioUri,
      });

      setReplies((prev) => [...prev, savedReply]);
      setReplyAudioUri(null);
      setReplySeconds(0);
      setReplyAuthor('');

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
    } catch (err) {
      Alert.alert('Upload Failed', 'Could not post your voice reply. Please try again.');
    } finally {
      setIsPostingReply(false);
    }
  }

  async function togglePlayReply(reply) {
    try {
      if (sound && isPlaying) await sound.pauseAsync();

      if (playingReplyId === reply._id && replySound) {
        await replySound.pauseAsync();
        setPlayingReplyId(null);
        return;
      }

      if (replySound) {
        await replySound.unloadAsync();
        setReplySound(null);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound: newReplySound } = await Audio.Sound.createAsync(
        { uri: reply.audioUrl },
        { shouldPlay: true, volume: 1.0 },
        (status) => {
          if (status.didJustFinish) {
            setPlayingReplyId(null);
          }
        }
      );
      setReplySound(newReplySound);
      setPlayingReplyId(reply._id);
    } catch (err) {
      Alert.alert('Playback Error', 'Unable to play this voice reply.');
      setPlayingReplyId(null);
    }
  }

  function handleClose() {
    unloadAllAudio();
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
      <View style={[styles.backdrop, { backgroundColor: theme.backdrop }]}>
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: theme.modalBg, borderColor: theme.border },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.badgeRow}>
                <View style={[styles.unlockedBadge, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons name="radio" size={12} color={theme.accent} />
                  <Text style={[styles.unlockedBadgeText, { color: theme.accent }]}>
                    UNLOCKED FREQUENCY
                  </Text>
                </View>
                <View
                  style={[
                    styles.categoryPill,
                    { backgroundColor: theme.surfaceElevated },
                  ]}
                >
                  <Text style={[styles.categoryPillText, { color: theme.textMuted }]}>
                    {capsule.category}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={[styles.closeBtn, { backgroundColor: theme.surfaceElevated }]}
              >
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Title & Author */}
            <Text style={[styles.title, { color: theme.text }]}>{capsule.title}</Text>
            <Text style={[styles.author, { color: theme.textMuted }]}>
              Recorded by{' '}
              <Text style={{ color: theme.primary, fontWeight: '600' }}>
                {capsule.author}
              </Text>
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
                      backgroundColor: isPlaying ? theme.primary : theme.border,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Progress Timeline */}
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBarBg,
                  { backgroundColor: theme.surfaceElevated },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent}%`, backgroundColor: theme.primary },
                  ]}
                />
              </View>
              <View style={styles.timeRow}>
                <Text style={[styles.timeText, { color: theme.textDim }]}>
                  {Math.floor(positionMillis / 1000)}s
                </Text>
                <Text style={[styles.timeText, { color: theme.textDim }]}>
                  {Math.ceil(durationMillis / 1000)}s
                </Text>
              </View>
            </View>

            {/* Controls */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={[
                  styles.iconBtn,
                  {
                    backgroundColor: hasLiked
                      ? theme.dangerSoft
                      : theme.surfaceElevated,
                  },
                ]}
                onPress={handleLike}
              >
                <Ionicons
                  name={hasLiked ? 'heart' : 'heart-outline'}
                  size={21}
                  color={hasLiked ? theme.danger : theme.textMuted}
                />
                <Text
                  style={[
                    styles.btnLabel,
                    { color: hasLiked ? theme.danger : theme.textMuted },
                  ]}
                >
                  {likes}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: theme.primary }]}
                onPress={togglePlayPause}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.primaryText} />
                ) : (
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={26}
                    color={theme.primaryText}
                    style={{ marginLeft: isPlaying ? 0 : 3 }}
                  />
                )}
              </TouchableOpacity>

              <View
                style={[styles.iconBtn, { backgroundColor: theme.surfaceElevated }]}
              >
                <Ionicons name="headset-outline" size={21} color={theme.textMuted} />
                <Text style={[styles.btnLabel, { color: theme.textMuted }]}>
                  {capsule.listens || 0}
                </Text>
              </View>
            </View>

            {playbackError ? (
              <View style={styles.geoFooter}>
                <Ionicons name="alert-circle" size={13} color={theme.danger} />
                <Text style={[styles.geoFooterText, { color: theme.danger }]}>
                  {playbackError}
                </Text>
              </View>
            ) : (
              <View style={styles.geoFooter}>
                <Ionicons name="shield-checkmark" size={13} color={theme.accent} />
                <Text style={[styles.geoFooterText, { color: theme.textDim }]}>
                  Unlocked within 30m proximity zone
                </Text>
              </View>
            )}

            {/* Audio Guestbook (Whisper Chains) */}
            <View style={[styles.guestbookSection, { borderTopColor: theme.border }]}>
              <View style={styles.guestbookHeader}>
                <View style={styles.guestbookTitleRow}>
                  <Ionicons name="chatbubbles-outline" size={16} color={theme.primary} />
                  <Text style={[styles.guestbookTitle, { color: theme.text }]}>
                    Audio Guestbook
                  </Text>
                </View>
                <Text style={[styles.guestbookCount, { color: theme.textDim }]}>
                  {replies.length} {replies.length === 1 ? 'whisper' : 'whispers'}
                </Text>
              </View>

              {/* Existing Replies */}
              {replies.length === 0 ? (
                <Text style={[styles.guestbookEmpty, { color: theme.textMuted }]}>
                  No whispers left here yet. Leave a 10s voice reply below!
                </Text>
              ) : (
                <View style={styles.repliesList}>
                  {replies.map((rep) => {
                    const isRepPlaying = playingReplyId === rep._id;
                    return (
                      <TouchableOpacity
                        key={rep._id}
                        style={[
                          styles.replyItem,
                          {
                            backgroundColor: theme.surfaceElevated,
                            borderColor: isRepPlaying ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => togglePlayReply(rep)}
                      >
                        <View
                          style={[
                            styles.replyPlayDot,
                            { backgroundColor: theme.primarySoft },
                          ]}
                        >
                          <Ionicons
                            name={isRepPlaying ? 'pause' : 'play'}
                            size={14}
                            color={theme.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.replyAuthor, { color: theme.text }]}>
                            {rep.author || 'Anonymous Explorer'}
                          </Text>
                          <Text style={[styles.replyMeta, { color: theme.textMuted }]}>
                            {rep.duration || 10}s voice whisper
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* 10s Whisper Recorder */}
              <View
                style={[
                  styles.replyComposer,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.replyComposerTop}>
                  <TouchableOpacity
                    style={[
                      styles.replyMicBtn,
                      {
                        backgroundColor: isRecordingReply
                          ? theme.danger
                          : theme.primary,
                      },
                    ]}
                    onPress={
                      isRecordingReply
                        ? () => stopReplyRecording()
                        : startReplyRecording
                    }
                  >
                    <Ionicons
                      name={isRecordingReply ? 'stop' : 'mic'}
                      size={18}
                      color={theme.primaryText}
                    />
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.replyComposerTitle, { color: theme.text }]}>
                      {isRecordingReply
                        ? `Recording whisper... ${replySeconds}s / ${MAX_REPLY_SECONDS}s`
                        : replyAudioUri
                        ? `Recorded ${replySeconds}s whisper`
                        : 'Leave a 10s voice reply'}
                    </Text>
                    <Text style={[styles.replyComposerSub, { color: theme.textMuted }]}>
                      {isRecordingReply
                        ? 'Tap stop when finished'
                        : replyAudioUri
                        ? 'Add your name (optional) and send'
                        : 'Tap mic to append to this spot'}
                    </Text>
                  </View>
                </View>

                {replyAudioUri && (
                  <View style={styles.replySendRow}>
                    <TextInput
                      style={[
                        styles.replyNameInput,
                        {
                          backgroundColor: theme.modalBg,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder="Your name (optional)"
                      placeholderTextColor={theme.textDim}
                      value={replyAuthor}
                      onChangeText={setReplyAuthor}
                    />
                    <TouchableOpacity
                      style={[styles.replySendBtn, { backgroundColor: theme.accent }]}
                      onPress={handlePostReply}
                      disabled={isPostingReply}
                    >
                      {isPostingReply ? (
                        <ActivityIndicator size="small" color={theme.primaryText} />
                      ) : (
                        <Text style={[styles.replySendText, { color: theme.primaryText }]}>
                          Post
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    borderWidth: 1,
    paddingBottom: 32,
    maxHeight: '88%',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  unlockedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  author: {
    fontSize: 13,
    marginBottom: 16,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 46,
    marginVertical: 10,
    paddingHorizontal: 8,
  },
  waveBar: {
    width: 6,
    height: 44,
    borderRadius: 3,
  },
  progressContainer: {
    marginVertical: 8,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 11,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 12,
    marginBottom: 8,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  btnLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  geoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 5,
  },
  geoFooterText: {
    fontSize: 11,
    textAlign: 'center',
  },
  guestbookSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  guestbookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  guestbookTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guestbookTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  guestbookCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  guestbookEmpty: {
    fontSize: 12,
    marginBottom: 12,
  },
  repliesList: {
    gap: 8,
    marginBottom: 12,
  },
  replyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  replyPlayDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyAuthor: {
    fontSize: 13,
    fontWeight: '700',
  },
  replyMeta: {
    fontSize: 11,
  },
  replyComposer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  replyComposerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  replyMicBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyComposerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  replyComposerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  replySendRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  replyNameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  replySendBtn: {
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replySendText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
