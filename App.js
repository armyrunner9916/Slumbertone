// App.js – Fixed PerfectLoop integration with diagnostics
// All UI remains EXACTLY the same - only fixing audio looping

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  Platform, Animated, useWindowDimensions, TextInput, KeyboardAvoidingView, Modal, NativeModules, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Asset } from 'expo-asset';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
  Capability, RepeatMode, AppKilledPlaybackBehavior, Event
} from 'react-native-track-player';

const { PerfectLoop } = NativeModules;

// Add diagnostic logging at module load
console.log('=== PerfectLoop Module Status ===');
console.log('PerfectLoop available:', !!PerfectLoop);
if (PerfectLoop) {
  console.log('PerfectLoop methods:', Object.keys(PerfectLoop));
} else {
  console.warn('PerfectLoop module NOT FOUND - will use RNTP fallback (gaps possible)');
}
console.log('================================');

/* ----------------- Sound metadata ----------------- */
const SOUND_OPTIONS = [
  { key: 'white', name: 'White Noise', color: '#e5e7eb', icon: 'cloud-outline',  description: 'Equal energy across all frequencies' },
  { key: 'pink',  name: 'Pink Noise',  color: '#f9a8d4', icon: 'rose-outline',   description: 'Gentle, natural sound good for sleep' },
  { key: 'green', name: 'Green Noise', color: '#86efac', icon: 'leaf-outline',   description: 'Nature-like, emphasized mids' },
  { key: 'brown', name: 'Brown Noise', color: '#fde68a', icon: 'planet-outline', description: 'Deeper, bass-weighted spectrum' },
];

const SOUND_URIS = Platform.select({
  ios: {
    white: require('./assets/sounds/ios/white_noise.caf'),
    pink:  require('./assets/sounds/ios/pink_noise.caf'),
    green: require('./assets/sounds/ios/green_noise.caf'),
    brown: require('./assets/sounds/ios/brown_noise.caf'),
  },
  android: {
    white: require('./assets/sounds/android/white_noise.m4a'),
    pink:  require('./assets/sounds/android/pink_noise.m4a'),
    green: require('./assets/sounds/android/green_noise.m4a'),
    brown: require('./assets/sounds/android/brown_noise.m4a'),
  },
});

/* ----------------- Gradients ----------------- */
const GRADIENTS = {
  neutral: { dark: ['#0f172a','#0b2a4a','#0a3b5e','#0f5f74','#1c7aa6','#2f88d0'],
             light:['#eef2ff','#dbeafe','#cffafe','#e0f2fe','#d1fae5','#fce7f3'] },
  white:   { dark: ['#0b1020','#1f2937','#334155','#475569','#64748b','#94a3b8'],
             light:['#f8fafc','#eef2f7','#e2e8f0','#d9e1eb','#cfd8e3','#c7d2fe'] },
  pink:    { dark: ['#2b0b1c','#3d0f2b','#57123f','#6d1650','#8a1c65','#b83280'],
             light:['#fff1f5','#ffe4f0','#ffd7ea','#ffc4e1','#ffb3da','#f472b6'] },
  green:   { dark: ['#081c17','#0f2f25','#104236','#0f5241','#0f6a4b','#10b981'],
             light:['#ecfdf5','#d1fae5','#a7f3d0','#6ee7b7','#34d399','#10b981'] },
  brown:   { dark: ['#20160e','#2a1b10','#3b2614','#4b2f17','#5f3a1a','#8b5e34'],
             light:['#fff7ed','#ffedd5','#fde6c8','#f5d7b6','#e8c9a3','#d1a374'] },
};
const getGradient = (key, isDark) => (GRADIENTS[key] || GRADIENTS.neutral)[isDark ? 'dark' : 'light'];
const getAccentColor = (soundKey, isDark) => {
  const g = getGradient(soundKey || 'neutral', isDark);
  return g[Math.min(g.length - 1, 4)];
};
const textOn = (hex) => {
  try {
    const c = hex.replace('#','');
    const r = parseInt(c.slice(0,2),16)/255;
    const g = parseInt(c.slice(2,4),16)/255;
    const b = parseInt(c.slice(4,6),16)/255;
    const L = 0.2126*r + 0.7152*g + 0.0722*b;
    return L > 0.62 ? '#0b1020' : '#ffffff';
  } catch { return '#ffffff'; }
};

/* ----------------- Tiny UI helper ----------------- */
const usePressScale = (from=1, to=0.96, dur=90) => {
  const scale = useRef(new Animated.Value(from)).current;
  const onPressIn  = () => Animated.timing(scale,{toValue:to,duration:dur,useNativeDriver:true}).start();
  const onPressOut = () => Animated.timing(scale,{toValue:from,duration:dur+40,useNativeDriver:true}).start();
  return { scale, onPressIn, onPressOut };
};

/* ----------------- RNTP service (Android) ----------------- */
TrackPlayer.registerPlaybackService(() => async () => {
  TrackPlayer.addEventListener(Event.RemotePlay,  () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop,  () => TrackPlayer.stop());
});

const ARTWORK = require('./assets/images/icon.png');

/* ---------- iOS RNTP fallback: lazy setup ---------- */
let rntpReadyIOS = false;
async function ensureRNTPReadyIOS() {
  if (rntpReadyIOS) return;
  await TrackPlayer.setupPlayer({
    iosCategory: 'playback',
    iosCategoryMode: 'default',
    iosCategoryOptions: ['mixWithOthers'],
    androidAudioContentType: 'music',
    androidAudioUsage: 'media',
    androidStayActiveInBackground: true,
    appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
  });
  await TrackPlayer.updateOptions({
    stopWithApp: false,
    capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
    compactCapabilities: [Capability.Play, Capability.Pause],
    notificationCapabilities: [Capability.Play, Capability.Pause, Capability.Stop],
    alwaysPauseOnInterruption: false,
  });
  rntpReadyIOS = true;
}

/* ----------------- Main ----------------- */
const Slumbertone = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet   = width >= 834;
  const contentMax = isTablet ? 1008 : 640;
  const titleSize  = isTablet ? 44 : 36;

  const [isDarkMode, setIsDarkMode] = useState(true);
  const theme = useMemo(() => ({
    text: isDarkMode ? '#f8fafc' : '#0b1020',
    mild: isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)',
    primary: '#fbbf24',
    onPrimary: '#0b1020',
    cardTint: isDarkMode ? 'dark' : 'light',
  }), [isDarkMode]);

  const [selectedSound, setSelectedSound] = useState('green');
  const [isPlaying, setIsPlaying]         = useState(false);
  const [volume, setVolume]               = useState(1.0);
  const [ready, setReady]                 = useState(false);
  const [usingPerfectLoop, setUsingPerfectLoop] = useState(false);

  // timers
  const [timerMs, setTimerMs] = useState(0);
  const [endAt, setEndAt]     = useState(null);
  const [endBehavior, setEndBehavior] = useState('fade');
  const [nowMs, setNowMs]     = useState(Date.now());

  // Custom (HH:MM)
  const [showCustom, setShowCustom]       = useState(false);
  const [customHours, setCustomHours]     = useState('0');
  const [customMinutes, setCustomMinutes] = useState('30');
  const [customDurMsIOS, setCustomDurMsIOS] = useState(30 * 60 * 1000);
  const [pickerKey, setPickerKey]         = useState(0);

  // Stop At…
  const [showStopAt, setShowStopAt] = useState(false);
  const [tempStopAtDate, setTempStopAtDate] = useState(new Date());

  // Color sound picker modal
  const [showPicker, setShowPicker] = useState(false);

  // Android RNTP preload
  const assetUrisRef = useRef({});

  /* ---------- Setup ---------- */
  useEffect(() => {
    (async () => {
      // Check PerfectLoop availability on iOS
      if (Platform.OS === 'ios') {
        const available = !!PerfectLoop;
        console.log(`iOS: PerfectLoop module ${available ? 'FOUND' : 'NOT FOUND (using fallback)'}`);
        if (!available) {
          console.warn('⚠️ PerfectLoop not available - audio may have gaps. Build with dev client or production build to enable lossless looping.');
        }
      }

      if (Platform.OS === 'android') {
        for (const [k, mod] of Object.entries(SOUND_URIS)) {
          const asset = Asset.fromModule(mod);
          await asset.downloadAsync();
          assetUrisRef.current[k] = asset.localUri ?? asset.uri;
        }
        try {
          await TrackPlayer.setupPlayer({
            iosCategory: 'playback',
            iosCategoryMode: 'default',
            iosCategoryOptions: ['mixWithOthers'],
            androidAudioContentType: 'music',
            androidAudioUsage: 'media',
            androidStayActiveInBackground: true,
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback
          });
          await TrackPlayer.updateOptions({
            stopWithApp: false,
            capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
            compactCapabilities: [Capability.Play, Capability.Pause]
          });
        } catch {}
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try { 
        if (Platform.OS === 'ios' && PerfectLoop?.setVolume) {
          await PerfectLoop.setVolume(volume);
        } else {
          await TrackPlayer.setVolume(volume);
        }
      } catch {}
    })();
  }, [volume]);

  const setNowPlaying = async (title) => {
    if (Platform.OS === 'ios' && PerfectLoop?.setNowPlaying) {
      try { await PerfectLoop.setNowPlaying(title); } catch {}
    } else {
      try {
        const t = await TrackPlayer.getActiveTrack();
        if (t?.id) await TrackPlayer.updateMetadataForTrack(t.id, { title, artist: 'Slumbertone', artwork: ARTWORK });
      } catch {}
    }
  };

  // iOS primary (PerfectLoop) - with better error handling
  const playIOSPrimary = async (key) => {
    if (!PerfectLoop) {
      throw new Error('PerfectLoop module not available');
    }
    if (!PerfectLoop.load) {
      throw new Error('PerfectLoop.load method not available');
    }
    
    const asset = Asset.fromModule(SOUND_URIS[key]);
    await asset.downloadAsync();
    const path = asset.localUri || asset.uri;
    
    console.log(`Loading audio file: ${path}`);
    
    try {
      await PerfectLoop.load(path);
      await PerfectLoop.play(volume);
      setUsingPerfectLoop(true);
      console.log('✅ Playing with PerfectLoop (lossless)');
    } catch (error) {
      console.error('PerfectLoop playback error:', error);
      throw error;
    }
  };

  // iOS fallback (RNTP)
  const playIOSFallback = async (key, title) => {
    console.log('⚠️ Using RNTP fallback - audio may have gaps');
    await ensureRNTPReadyIOS();
    const asset = Asset.fromModule(SOUND_URIS[key]);
    await asset.downloadAsync();
    const url = asset.localUri || asset.uri;
    await TrackPlayer.reset();
    await TrackPlayer.add({ id: key, url, title, artist: 'Slumbertone', artwork: ARTWORK });
    await TrackPlayer.setRepeatMode(RepeatMode.Track);
    await TrackPlayer.play();
    setUsingPerfectLoop(false);
  };

  const playSound = async (key) => {
    if (!ready) return;
    const title = SOUND_OPTIONS.find(s => s.key === key)?.name ?? key;
    try {
      if (Platform.OS === 'ios') {
        try { 
          await playIOSPrimary(key);
        } catch (e) {
          console.warn('PerfectLoop failed, using fallback:', e.message);
          await playIOSFallback(key, title);
        }
      } else {
        const url = assetUrisRef.current[key];
        if (!url) return;
        await TrackPlayer.reset();
        await TrackPlayer.add({ id: key, url, title, artist: 'Slumbertone', artwork: ARTWORK });
        await TrackPlayer.setRepeatMode(RepeatMode.Track);
        await TrackPlayer.play();
      }
      await setNowPlaying(title);
      setIsPlaying(true);
    } catch (e) {
      console.error('Playback error:', e);
      Alert.alert('Playback error', 'Could not start audio: ' + e.message);
    }
  };

  const stopSound = async () => {
    try {
      if (Platform.OS === 'ios' && PerfectLoop?.stop) {
        await PerfectLoop.stop();
      } else {
        await TrackPlayer.stop();
      }
    } catch (e) {
      console.error('Stop error:', e);
    }
    setIsPlaying(false);
    setUsingPerfectLoop(false);
  };

  // Button handlers
  const handlePlay = async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    await playSound(selectedSound);
  };
  
  const handleStop = async () => {
    Haptics.selectionAsync();
    await stopSound();
  };
  
  const changeSound = async (key) => {
    Haptics.selectionAsync();
    setSelectedSound(key);
    if (isPlaying) await playSound(key);
  };

  /* ---------- Timers ---------- */
  const scheduleCountdown = (ms) => {
    if (!ms || ms <= 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimerMs(ms);
    setEndAt(Date.now() + ms);
    if (!isPlaying) handlePlay();
  };
  const preset = (m) => () => scheduleCountdown(m*60*1000);
  const cancelTimer = () => { setTimerMs(0); setEndAt(null); };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const hhmmToMs = (h, m) => {
    const H = clamp(parseInt(h||'0',10) || 0, 0, 23);
    const M = clamp(parseInt(m||'0',10) || 0, 0, 59);
    return H*3600000 + M*60000;
  };

  useEffect(() => {
    if (!endAt) return;
    let alive = true;
    const id = setInterval(async () => {
      if (!alive) return;
      setNowMs(Date.now());
      if (Date.now() >= endAt) {
        clearInterval(id);
        if (endBehavior === 'fade') {
          const steps = 12, start = volume;
          for (let i=0; i<steps; i++) {
            const f = 1 - (i+1)/steps;
            try {
              if (Platform.OS === 'ios' && PerfectLoop?.setVolume) {
                await PerfectLoop.setVolume(start*f);
              } else {
                await TrackPlayer.setVolume(start*f);
              }
            } catch {}
            await new Promise(r => setTimeout(r, 1000/steps));
          }
        }
        await handleStop();
      }
    }, 1000);
    return () => { alive = false; clearInterval(id); };
  }, [endAt, endBehavior]);

  // Stop At… (local time; Set applies)
  const onStopAtTempChange = (_e, d) => { if (d) setTempStopAtDate(d); };
  const applyStopAt = () => {
    const now = new Date();
    const t = new Date(now);
    t.setHours(tempStopAtDate.getHours(), tempStopAtDate.getMinutes(), 0, 0);
    if (t.getTime() <= now.getTime()) t.setDate(t.getDate()+1);
    setEndAt(t.getTime());
    setTimerMs(t.getTime() - now.getTime());
    setShowStopAt(false);
    if (!isPlaying) handlePlay();
  };

  const remainingText = () => {
    if (!endAt) return 'No stop scheduled';
    const ms = Math.max(0, endAt - nowMs);
    const s  = Math.floor(ms/1000);
    const h  = Math.floor(s/3600);
    const m  = Math.floor((s%3600)/60);
    const ss = s%60;
    return `Will stop in ${h ? `${h}h ` : ''}${m}m ${ss}s`;
  };

  const currentColors = getGradient(isPlaying ? selectedSound : 'neutral', isDarkMode);
  const accent = getAccentColor(selectedSound, isDarkMode);

  /* ---------- UI ---------- */
  const playScale  = usePressScale();
  const stopScale  = usePressScale();

  return (
    <SafeAreaProvider>
      <View style={styles.flex}>
        <LinearGradient colors={currentColors} start={{ x: 0.05, y: 0.05 }} end={{ x: 1, y: 1 }}
          locations={[0, 0.18, 0.36, 0.58, 0.8, 1]} style={StyleSheet.absoluteFill} />
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <SafeAreaView style={[styles.safe, { paddingTop: insets.top + 8 }]}>

          <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 28 }}>
            <View style={{ width: Math.min(width - 32, contentMax) }}>

              {/* Header */}
              <View style={styles.headerWrap}>
                <Text style={[styles.title, { color: theme.text, fontSize: titleSize }]}>Slumbertone</Text>
                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setIsDarkMode(v => !v); }}
                  style={styles.themeToggle} accessibilityLabel="Toggle appearance">
                  <Ionicons name={isDarkMode ? 'sunny-outline' : 'moon-outline'} size={22} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Now Playing (Play + Stop) */}
              <GlassCard tint={theme.cardTint}>
                <View style={styles.row}>
                  <Ionicons name={(SOUND_OPTIONS.find(s=>s.key===selectedSound)?.icon)||'musical-notes-outline'}
                    size={26} color={(SOUND_OPTIONS.find(s=>s.key===selectedSound)?.color)||theme.text} />
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {SOUND_OPTIONS.find(s=>s.key===selectedSound)?.name || 'Noise'}
                  </Text>
                  <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowPicker(true); }} style={styles.link}>
                    <Text style={[styles.linkText, { color: theme.text }]}>Change</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.caption, { color: theme.mild, marginTop: 4 }]}>
                  {SOUND_OPTIONS.find(s=>s.key===selectedSound)?.description}
                </Text>

                {/* Diagnostic indicator for iOS */}
                {Platform.OS === 'ios' && isPlaying && (
                  <Text style={[styles.caption, { 
                    color: usingPerfectLoop ? '#22c55e' : '#f59e0b',
                    marginTop: 4,
                    fontSize: 12
                  }]}>
                    {usingPerfectLoop ? '✓ Lossless looping active' : '⚠️ Using fallback (may have gaps)'}
                  </Text>
                )}

                <View style={styles.controls}>
                  <Animated.View style={{ transform: [{ scale: playScale.scale }] }}>
                    <TouchableOpacity onPressIn={playScale.onPressIn} onPressOut={playScale.onPressOut}
                      style={[styles.btn, { backgroundColor: theme.primary }]} onPress={handlePlay}>
                      <Ionicons name="play" size={24} color={theme.onPrimary} />
                      <Text style={[styles.btnText, { color: theme.onPrimary }]}>Play</Text>
                    </TouchableOpacity>
                  </Animated.View>
                  <Animated.View style={{ transform: [{ scale: stopScale.scale }] }}>
                    <TouchableOpacity onPressIn={stopScale.onPressIn} onPressOut={stopScale.onPressOut}
                      style={[styles.btn, styles.stopBtn]} onPress={handleStop}>
                      <Ionicons name="stop-circle-outline" size={24} color="#fff" />
                      <Text style={styles.btnText}>Stop</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </GlassCard>

              {/* Timers */}
              <GlassCard tint={theme.cardTint}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Timers</Text>

                <View style={styles.rowWrap}>
                  <Pill label="15m" onPress={preset(15)} textColor={theme.text} />
                  <Pill label="30m" onPress={preset(30)} textColor={theme.text} />
                  <Pill label="1h"  onPress={preset(60)} textColor={theme.text} />
                  <Pill
                    label="Custom"
                    outline
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCustomHours('0');
                      setCustomMinutes('1');
                      setCustomDurMsIOS(60 * 1000);
                      setPickerKey(k => k + 1);
                      setShowCustom(true);
                    }}
                    textColor={theme.text}
                  />
                </View>

                <View style={[styles.row, { marginTop: 10 }]}>
                  <Pill label="Stop At…" outline onPress={() => { Haptics.selectionAsync(); setTempStopAtDate(new Date()); setShowStopAt(true); }} textColor={theme.text} />
                </View>

                <Text style={[styles.caption, { color: theme.mild, marginTop: 12 }]}>{remainingText()}</Text>

                <View style={[styles.row, { marginTop: 14 }]}>
                  <Pill label="Fade out" selected={endBehavior==='fade'} onPress={()=>setEndBehavior('fade')}
                        selectedColor={getAccentColor(selectedSound, isDarkMode)} textColor={theme.text} />
                  <Pill label="Immediate" selected={endBehavior==='immediate'} onPress={()=>setEndBehavior('immediate')}
                        selectedColor={getAccentColor(selectedSound, isDarkMode)} textColor={theme.text} />
                </View>

                {!!endAt && (
                  <View style={[styles.row, { marginTop: 10 }]}>
                    <Pill label="Cancel timer" outline onPress={cancelTimer} textColor={theme.text} />
                  </View>
                )}
              </GlassCard>

            </View>
          </ScrollView>

          {/* Sound Picker Modal */}
          <Modal visible={showPicker} animationType="fade" transparent onRequestClose={()=>setShowPicker(false)}>
            <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={styles.modalWrap}>
              <BlurView tint={theme.cardTint} intensity={70} style={styles.modalCard}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Choose a sound</Text>
                {SOUND_OPTIONS.map((s, idx) => (
                  <View key={s.key}>
                    <TouchableOpacity style={styles.soundRow} onPress={() => { changeSound(s.key); setShowPicker(false); }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Ionicons name={s.icon} size={22} color={s.color} />
                        <Text style={[styles.soundName, { color: theme.text }]}>{s.name}</Text>
                      </View>
                      {selectedSound === s.key && <Ionicons name="checkmark-circle" size={22} color="#22c55e" />}
                    </TouchableOpacity>
                    {idx < SOUND_OPTIONS.length-1 && <View style={styles.divider} />}
                  </View>
                ))}
                <View style={[styles.row, { justifyContent: 'flex-end', marginTop: 8 }]}>
                  <TouchableOpacity style={[styles.btnSmall, styles.btnGhost]} onPress={()=>setShowPicker(false)}>
                    <Text style={[styles.btnSmallText, { color: theme.text }]}>Done</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </KeyboardAvoidingView>
          </Modal>

          {/* Custom (HH:MM) Modal */}
          <Modal visible={showCustom} animationType="fade" transparent onRequestClose={()=>setShowCustom(false)}>
            <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={styles.modalWrap}>
              <BlurView tint={theme.cardTint} intensity={70} style={styles.modalCard}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Custom (HH:MM)</Text>

                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    key={`picker-${pickerKey}`}
                    mode="countdown"
                    value={new Date(customDurMsIOS)}
                    display="spinner"
                    onChange={(e, d) => {
                      const durMin = e?.nativeEvent?.duration ?? e?.nativeEvent?.minuteInterval;
                      if (durMin != null && !isNaN(Number(durMin))) {
                        const totalMin = Number(durMin), h = Math.floor(totalMin / 60), m = totalMin % 60;
                        setCustomHours(String(h)); setCustomMinutes(String(m)); setCustomDurMsIOS(totalMin * 60000); return;
                      }
                      if (!d) return;
                      let h = d.getHours(); let m = d.getMinutes();
                      const prevH = parseInt(customHours || '0', 10) || 0;
                      const prevM = parseInt(customMinutes || '0', 10) || 0;
                      const hoursJump = Math.abs(h - prevH);
                      if (m !== prevM && (hoursJump === 23 || (hoursJump === 1 && (m === 0 || prevM === 0)))) h = prevH;
                      setCustomHours(String(h)); setCustomMinutes(String(m)); setCustomDurMsIOS(h*3600000 + m*60000);
                    }}
                  />
                ) : (
                  <View style={[styles.row, { gap: 12 }]}>
                    <TextInput value={customHours} onChangeText={setCustomHours} keyboardType="number-pad"
                      placeholder="HH" placeholderTextColor="#999"
                      style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.mild }]} />
                    <TextInput value={customMinutes} onChangeText={setCustomMinutes} keyboardType="number-pad"
                      placeholder="MM" placeholderTextColor="#999"
                      style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.mild }]} />
                  </View>
                )}

                <View style={[styles.row, { justifyContent: 'flex-end', marginTop: 10 }]}>
                  <TouchableOpacity style={[styles.btnSmall, styles.btnGhost]} onPress={()=>setShowCustom(false)}>
                    <Text style={[styles.btnSmallText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnSmall, styles.btnPrimary]}
                    onPress={()=>{
                      const ms = Platform.OS === 'ios' ? customDurMsIOS : hhmmToMs(customHours, customMinutes);
                      setShowCustom(false);
                      scheduleCountdown(ms);
                    }}>
                    <Text style={[styles.btnSmallText, { color: '#0b1020' }]}>Start</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </KeyboardAvoidingView>
          </Modal>

          {/* Stop At… Modal */}
          <Modal visible={showStopAt} animationType="fade" transparent onRequestClose={()=>setShowStopAt(false)}>
            <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={styles.modalWrap}>
              <BlurView tint={theme.cardTint} intensity={70} style={styles.modalCard}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Stop At…</Text>
                <DateTimePicker mode="time" value={tempStopAtDate} display={Platform.OS==='ios' ? 'spinner' : 'default'} onChange={onStopAtTempChange}/>
                <View style={[styles.row, { justifyContent: 'flex-end', marginTop: 10, gap: 8 }]}>
                  <TouchableOpacity style={[styles.btnSmall, styles.btnGhost]} onPress={()=>setShowStopAt(false)}>
                    <Text style={[styles.btnSmallText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnSmall, styles.btnPrimary]} onPress={applyStopAt}>
                    <Text style={[styles.btnSmallText, { color: '#0b1020' }]}>Set</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </KeyboardAvoidingView>
          </Modal>

        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
};

/* ----------------- UI Components ----------------- */
const GlassCard = ({ children, tint='dark' }) => (
  <BlurView tint={tint} intensity={68} style={styles.card}>
    <View style={styles.cardInner}>{children}</View>
  </BlurView>
);

const Pill = ({ label, onPress, outline, selected, selectedColor, textColor }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.pill,
      outline && styles.pillOutline,
      selected && (selectedColor
        ? { backgroundColor: selectedColor, borderColor: 'transparent' }
        : styles.pillSelected)
    ]}
  >
    <Text
      style={[
        styles.pillText,
        selected && selectedColor ? { color: textOn(selectedColor) } : (textColor ? { color: textColor } : null)
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

/* ----------------- Styles ----------------- */
const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1 },

  headerWrap: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  title: { fontWeight: '900', letterSpacing: 0.4, textAlign: 'center' },
  themeToggle: {
    position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)',
  },

  card: {
    borderRadius: 24, marginBottom: 16, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)',
    ...Platform.select({ ios: { shadowColor:'#000', shadowOpacity:0.15, shadowRadius:20, shadowOffset:{width:0,height:10} },
                         android:{ elevation: 6 } }),
  },
  cardInner: { padding: 16, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  cardTitle: { fontSize: 22, fontWeight: '900', flex: 1 },
  caption:   { fontSize: 14, fontWeight: '600' },

  controls: { flexDirection: 'row', gap: 12, marginTop: 14 },

  btn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16 },
  btnText: { color: '#fff', fontWeight: '900' },
  stopBtn: { backgroundColor: '#0b1020' },

  link: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(251,191,36,0.14)' },
  linkText: { fontWeight: '900' },

  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10 },

  pill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.24)',
          backgroundColor: 'rgba(255,255,255,0.14)' },
  pillOutline: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.28)' },
  pillSelected: { backgroundColor: 'rgba(255,255,255,0.22)' },
  pillText: { fontWeight: '800', fontSize: 15, color: '#fff' },

  modalWrap: { position:'absolute', left:0,right:0,top:0,bottom:0, justifyContent:'center', alignItems:'center',
               paddingHorizontal:16, backgroundColor:'rgba(0,0,0,0.35)' },
  modalCard: { width:'100%', maxWidth:480, borderRadius:20, padding:16, borderWidth:StyleSheet.hairlineWidth,
               borderColor:'rgba(255,255,255,0.18)' },
  modalTitle: { fontSize:18, fontWeight:'900', marginBottom:8 },

  soundRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  soundName: { fontSize: 16, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },

  btnSmall: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  btnGhost: { backgroundColor: 'transparent' },
  btnPrimary: { backgroundColor: '#fbbf24' },
  btnSmallText: { fontWeight: '800', fontSize: 14 },

  input: { width:'100%', borderWidth:1, borderRadius:12, paddingHorizontal:12, paddingVertical:10, marginBottom:12,
           color:'#fff', borderColor:'rgba(255,255,255,0.3)' },
});

const App = () => (
  <SafeAreaProvider>
    <Slumbertone />
  </SafeAreaProvider>
);

export default App;