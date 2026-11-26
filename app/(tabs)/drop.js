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

import { CATEGORIES } from '../../utils/constants';
import { useTheme } from '../../utils/theme';
import { dropCapsuleApi } from '../../utils/api';

const MAX_RECORD_SECONDS = 30;

export default function DropStudioScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [previewSound, setPreviewSound] = useState(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

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

  useEffect(() => {
    let anim;
    if (isRecording) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.22,
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
      const serverMsg = err?.response?.data?.error;
      if (err?.response?.status === 409 && serverMsg) {
        Alert.alert('Spot Full', serverMsg);
      } else {
        Alert.alert('Upload Failed', serverMsg || 'Could not anchor capsule. Please check your internet connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Audio Drop Studio
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            Anchor your voice to your current physical location.
          </Text>
        </View>

        <View
          style={[
            styles.gpsBanner,
            {
              backgroundColor: location ? theme.accentSoft : theme.dangerSoft,
              borderColor: location ? theme.accent : theme.danger,
            },
          ]}
        >
          <Ionicons
            name={location ? 'location' : 'locate-outline'}
            size={16}
            color={location ? theme.accent : theme.danger}
          />
          <Text
            style={[
              styles.gpsText,
              { color: location ? theme.accent : theme.danger },
            ]}
          >
            {gpsStatus}
          </Text>
          <TouchableOpacity onPress={fetchCurrentLocation}>
            <Ionicons name="refresh" size={15} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.recorderCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.timerText, { color: theme.text }]}>
            00:{recordSeconds < 10 ? `0${recordSeconds}` : recordSeconds}
          </Text>
          <Text style={[styles.timerLimitText, { color: theme.textDim }]}>
            Max {MAX_RECORD_SECONDS}s spatial snippet
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={isRecording ? () => stopRecording() : startRecording}
            style={styles.micButtonWrapper}
          >
            <Animated.View
              style={[
                styles.micPulseRing,
                { borderColor: isRecording ? theme.danger : theme.primary },
                isRecording && { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View
              style={[
                styles.micButton,
                { backgroundColor: isRecording ? theme.danger : theme.primary },
              ]}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={32}
                color={theme.primaryText}
              />
            </View>
          </TouchableOpacity>

          <Text style={[styles.recInstruction, { color: theme.textMuted }]}>
            {isRecording
              ? 'Recording live audio... Tap to stop'
              : recordedUri
              ? 'Snippet recorded! Ready to drop or re-record.'
              : 'Tap microphone to start recording'}
          </Text>

          {recordedUri && (
            <TouchableOpacity
              style={[
                styles.previewBtn,
                { backgroundColor: theme.primarySoft, borderColor: theme.primary },
              ]}
              onPress={togglePreview}
            >
              <Ionicons
                name={isPreviewPlaying ? 'pause' : 'play'}
                size={16}
                color={theme.primary}
              />
              <Text style={[styles.previewBtnText, { color: theme.primary }]}>
                {isPreviewPlaying ? 'Pause Snippet' : 'Preview Recording'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>Capsule Title</Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="e.g. Secret Rooftop Frequency #3"
            placeholderTextColor={theme.textDim}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.inputLabel, { color: theme.text }]}>
            Author / Handle (Optional)
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Anonymous Explorer"
            placeholderTextColor={theme.textDim}
            value={author}
            onChangeText={setAuthor}
          />

          <Text style={[styles.inputLabel, { color: theme.text }]}>
            Frequency Category
          </Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.filter((c) => c.id !== 'All').map((cat) => {
              const isSelected = category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catOption,
                    {
                      backgroundColor: isSelected ? theme.primarySoft : theme.surface,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Ionicons
                    name={cat.icon}
                    size={16}
                    color={isSelected ? theme.primary : theme.textMuted}
                  />
                  <Text
                    style={[
                      styles.catOptionText,
                      { color: isSelected ? theme.primary : theme.textMuted },
                      isSelected && { fontWeight: '700' },
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
              { backgroundColor: theme.accent },
              (!recordedUri || !location) && styles.submitBtnDisabled,
            ]}
            onPress={handleDropCapsule}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.primaryText} />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color={theme.primaryText} />
                <Text style={[styles.submitBtnText, { color: theme.primaryText }]}>
                  Drop Audio Capsule
                </Text>
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
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  gpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  gpsText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  recorderCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 20,
  },
  timerText: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1,
  },
  timerLimitText: {
    fontSize: 11,
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
  },
  micButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  recInstruction: {
    fontSize: 12,
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
    borderWidth: 1,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formSection: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
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
    borderWidth: 1,
  },
  catOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontWeight: '800',
    fontSize: 15,
  },
});
