import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../utils/constants';
import { getApiBaseUrl, setCustomApiUrl } from '../../utils/api';
import CapsulePlayerModal from '../../components/CapsulePlayerModal';

export default function VaultScreen() {
  const [activeTab, setActiveTab] = useState('signals'); // 'signals' | 'config'
  const [activeCapsule, setActiveCapsule] = useState(null);
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());

  const sampleVaultItems = [
    {
      _id: 'vault-1',
      title: 'Whispering Willow Secret',
      author: 'EchoSeeker',
      category: 'Secret',
      duration: 18,
      audioUrl: `${getApiBaseUrl()}/uploads/demo-sound.mp3`,
      isUnlocked: true,
      likes: 19,
      listens: 42,
      decodedAt: 'Today, 4:15 PM',
    },
    {
      _id: 'vault-2',
      title: 'Late Night Synthesizer Vibe',
      author: 'NeonBeat',
      category: 'Music',
      duration: 25,
      audioUrl: `${getApiBaseUrl()}/uploads/demo-sound.mp3`,
      isUnlocked: true,
      likes: 34,
      listens: 88,
      decodedAt: 'Yesterday, 11:30 PM',
    },
  ];

  function handleSaveApiUrl() {
    if (apiUrl.trim()) {
      setCustomApiUrl(apiUrl.trim());
      Alert.alert('Updated', `API endpoint set to: ${apiUrl.trim()}`);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Frequency Vault</Text>
          <Text style={styles.headerSubtitle}>
            Your collection of decoded sound capsules and drops.
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="radio" size={18} color={COLORS.primary} />
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Detected</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="lock-open" size={18} color={COLORS.accent} />
            <Text style={styles.statValue}>5</Text>
            <Text style={styles.statLabel}>Unlocked</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="mic-circle" size={18} color="#F472B6" />
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statLabel}>Dropped</Text>
          </View>
        </View>

        {/* Tab switch */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'signals' && styles.tabBtnActive]}
            onPress={() => setActiveTab('signals')}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'signals' && styles.tabBtnTextActive,
              ]}
            >
              Unlocked Archive
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'config' && styles.tabBtnActive]}
            onPress={() => setActiveTab('config')}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'config' && styles.tabBtnTextActive,
              ]}
            >
              API Settings
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'signals' ? (
          <View style={styles.listSection}>
            {sampleVaultItems.map((item) => (
              <TouchableOpacity
                key={item._id}
                style={styles.vaultCard}
                onPress={() => setActiveCapsule(item)}
              >
                <View style={styles.vaultCardLeft}>
                  <View style={styles.playIconCircle}>
                    <Ionicons name="play" size={16} color="#090D16" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vaultTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.vaultMeta}>
                      {item.category} • {item.duration}s • {item.author}
                    </Text>
                  </View>
                </View>

                <View style={styles.vaultCardRight}>
                  <Text style={styles.decodedTime}>{item.decodedAt}</Text>
                  <View style={styles.likesRow}>
                    <Ionicons name="heart" size={12} color={COLORS.danger} />
                    <Text style={styles.likesCount}>{item.likes}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.configCard}>
            <Text style={styles.configTitle}>Backend Connection</Text>
            <Text style={styles.configDesc}>
              Set the REST API endpoint URL used by this device to talk to the
              SoundCache server.
            </Text>

            <Text style={styles.inputLabel}>Server Base URL</Text>
            <TextInput
              style={styles.urlInput}
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="http://localhost:3000"
              placeholderTextColor={COLORS.textDim}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => setApiUrl('http://localhost:3000')}
              >
                <Text style={styles.presetText}>Localhost</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => setApiUrl('http://10.0.2.2:3000')}
              >
                <Text style={styles.presetText}>Android (10.0.2.2)</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.saveConfigBtn}
              onPress={handleSaveApiUrl}
            >
              <Text style={styles.saveConfigText}>Save Endpoint</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Player Modal */}
      <CapsulePlayerModal
        visible={!!activeCapsule}
        capsule={activeCapsule}
        onClose={() => setActiveCapsule(null)}
      />
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#1E293B',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  listSection: {
    gap: 10,
  },
  vaultCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  vaultCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  playIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  vaultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  vaultMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  vaultCardRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  decodedTime: {
    fontSize: 10,
    color: COLORS.textDim,
  },
  likesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  likesCount: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  configCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  configTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  configDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  urlInput: {
    backgroundColor: '#0c1220',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.text,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  presetText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  saveConfigBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveConfigText: {
    color: '#090D16',
    fontWeight: '700',
    fontSize: 13,
  },
});

