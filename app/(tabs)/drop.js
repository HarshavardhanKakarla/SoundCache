import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { COLORS, CATEGORIES } from '../../utils/constants';
import { dropCapsuleApi } from '../../utils/api';

const MAX_RECORD_SECONDS = 30;

export default function DropStudioScreen() {
  const router = useRouter();
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [previewSound, setPreviewSound] = useState(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Story');
  const [location, setLocation] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('Acquiring GPS signal...');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchCurrentLocation();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewSound) previewSound.unloadAsync();
    };
  }, []);

  async function fetchCurrentLocation() {
    try {
      setGpsStatus('Acquiring GPS signal...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        setGpsStatus('GPS Signal Locked • Ready to anchor');
      } else {
        setLocation(null);
        setGpsStatus('Location permission required to drop');
      }
    } catch (e) {
      setLocation(null);
      setGpsStatus('Unable to acquire GPS fix');
    }
  }

  // Pulsing animation while mic is live
  useEffect(() => {
    let anim;
    if (isRecording) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isRecording]);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone access is required to record audio capsules.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      if (previewSound) {
        await previewSound.unloadAsync();
        setPreviewSound(null);
        setIsPreviewPlaying(false);
      }
      setRecordedUri(null);
      setRecordSeconds(0);

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch (e) {}

      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= MAX_RECORD_SECONDS - 1) {
            stopRecording(newRecording);
            return MAX_RECORD_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn('Failed to start recording:', err);
      setIsRecording(false);
      Alert.alert(
        'Recording Error',
        'Could not start microphone recording. Please check microphone permissions and try again.'
      );
    }
  }

  async function stopRecording(activeRec = recording) {
    if (!activeRec) return;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      await activeRec.stopAndUnloadAsync();
      const uri = activeRec.getURI();
      setRecordedUri(uri);
      setRecording(null);

      // Reset audio mode for loudspeaker playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
    } catch (err) {
      console.warn('Failed to stop recording:', err);
    }
  }

  async function togglePreview() {
    if (!recordedUri) return;

    if (previewSound) {
      if (isPreviewPlaying) {
        await previewSound.pauseAsync();
        setIsPreviewPlaying(false);
      } else {
        await previewSound.playAsync();
        setIsPreviewPlaying(true);
      }
    } else {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: recordedUri },
          { shouldPlay: true, volume: 1.0 },
          (status) => {
            if (status.didJustFinish) {
              setIsPreviewPlaying(false);
            }
          }
        );
        setPreviewSound(sound);
        setIsPreviewPlaying(true);
      } catch (e) {
        console.warn('Preview error:', e);
        Alert.alert('Preview Error', 'Could not play back the recorded audio.');
      }
    }
  }

  async function handleDropCapsule() {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please give your audio capsule a title.');
      return;
    }
    if (!recordedUri) {
      Alert.alert('No Audio', 'Please record a voice note before dropping.');
      return;
    }
    if (!location) {
      Alert.alert('GPS Required', 'Waiting for your GPS location. Tap the refresh icon to retry.');
      return;
    }

    try {
      setIsSubmitting(true);

      await dropCapsuleApi({
        title: title.trim(),
        author: author.trim() || 'Anonymous Explorer',
        category,
        duration: recordSeconds || 1,
        latitude: location.latitude,
        longitude: location.longitude,
        audioUri: recordedUri,
      });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}

      Alert.alert(
        'Capsule Dropped!',
        `"${title.trim()}" has been anchored to your current location. Nearby explorers within 30m can now discover and listen to it!`,
        [
          {
            text: 'View on Radar',
            onPress: () => router.push('/(tabs)'),
          },
        ]
      );

      // Reset form
      setTitle('');
      setAuthor('');
      if (previewSound) {
        await previewSound.unloadAsync();
        setPreviewSound(null);
      }
      setIsPreviewPlaying(false);
      setRecordedUri(null);
      setRecordSeconds(0);
    } catch (err) {
      console.error('Drop capsule error:', err);
      Alert.alert('Upload Failed', 'Could not anchor capsule. Please check your internet connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Audio Drop Studio</Text>
          <Text style={styles.headerSubtitle}>
            Anchor your voice to your current physical location.
          </Text>
        </View>

        {/* GPS Status Banner (no raw coordinates exposed) */}
        <View style={styles.gpsBanner}>
          <Ionicons
            name={location ? 'location' : 'locate-outline'}
            size={16}
            color={location ? COLORS.accent : COLORS.danger}
          />
          <Text style={[styles.gpsText, !location && { color: COLORS.danger }]}>
            {gpsStatus}
          </Text>
          <TouchableOpacity onPress={fetchCurrentLocation}>
            <Ionicons name="refresh" size={15} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Voice Recorder Section */}
        <View style={styles.recorderCard}>
          <Text style={styles.timerText}>
            00:{recordSeconds < 10 ? `0${recordSeconds}` : recordSeconds}
          </Text>
          <Text style={styles.timerLimitText}>Max {MAX_RECORD_SECONDS}s spatial snippet</Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={isRecording ? () => stopRecording() : startRecording}
            style={styles.micButtonWrapper}
          >
            <Animated.View
              style={[
                styles.micPulseRing,
                isRecording && { transform: [{ scale: pulseAnim }] },
                isRecording && { borderColor: COLORS.danger },
              ]}
            />
            <View
              style={[
                styles.micButton,
                isRecording && { backgroundColor: COLORS.danger },
              ]}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={34}
                color={isRecording ? '#FFFFFF' : '#090D16'}
              />
            </View>
          </TouchableOpacity>

          <Text style={styles.recInstruction}>
            {isRecording
              ? 'Recording live audio... Tap to stop'
              : recordedUri
              ? 'Snippet recorded! Ready to drop or re-record.'
              : 'Tap microphone to start recording'}
          </Text>

          {recordedUri && (
            <TouchableOpacity style={styles.previewBtn} onPress={togglePreview}>
              <Ionicons
                name={isPreviewPlaying ? 'pause' : 'play'}
                size={16}
                color={COLORS.primary}
              />
              <Text style={styles.previewBtnText}>
                {isPreviewPlaying ? 'Pause Snippet' : 'Preview Recording'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Capsule Form Inputs */}
        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>Capsule Title</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Secret Rooftop Frequency #3"
            placeholderTextColor={COLORS.textDim}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.inputLabel}>Author / Handle (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Anonymous Explorer"
            placeholderTextColor={COLORS.textDim}
            value={author}
            onChangeText={setAuthor}
          />

          <Text style={styles.inputLabel}>Frequency Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.filter((c) => c.id !== 'All').map((cat) => {
              const isSelected = category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catOption,
                    isSelected && {
                      backgroundColor: 'rgba(0, 242, 254, 0.15)',
                      borderColor: COLORS.primary,
                    },
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Ionicons
                    name={cat.icon}
                    size={16}
                    color={isSelected ? COLORS.primary : COLORS.textMuted}
                  />
                  <Text
                    style={[
                      styles.catOptionText,
                      isSelected && { color: COLORS.primary, fontWeight: '700' },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!recordedUri || !location) && styles.submitBtnDisabled,
            ]}
            onPress={handleDropCapsule}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#090D16" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color="#090D16" />
                <Text style={styles.submitBtnText}>Drop Audio Capsule</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    marginVertical: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  gpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 160, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  gpsText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
  },
  recorderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 20,
  },
  timerText: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
  },
  timerLimitText: {
    fontSize: 11,
    color: COLORS.textDim,
    marginBottom: 16,
  },
  micButtonWrapper: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 8,
  },
  micPulseRing: {
    position: 'absolute',
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  micButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  recInstruction: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  previewBtnText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  formSection: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  catOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  catOptionText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#090D16',
    fontWeight: '800',
    fontSize: 15,
  },
});
