
// soundManager.js
import { Platform, NativeModules } from 'react-native';
import { Asset } from 'expo-asset';
import TrackPlayer, { RepeatMode } from 'react-native-track-player';

const { PerfectLoop } = NativeModules;

// Keep mapping local to avoid circular imports with App.js
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

const TITLES = {
  white: 'White Noise',
  pink:  'Pink Noise',
  green: 'Green Noise',
  brown: 'Brown Noise',
};

export async function playSound(key, volume = 1) {
  const title = TITLES[key] ?? key;
  if (Platform.OS === 'ios') {
    if (!PerfectLoop || !PerfectLoop.load) {
      console.warn('PerfectLoop native module is not available');
      return;
    }
    const moduleRef = SOUND_URIS[key];
    const asset = Asset.fromModule(moduleRef);
    await asset.downloadAsync();
    const path = asset.localUri || asset.uri;
    await PerfectLoop.load(path);
    if (PerfectLoop.setNowPlaying) {
      try { await PerfectLoop.setNowPlaying(title); } catch {}
    }
    await PerfectLoop.play(volume);
    return;
  }

  // Android
  try {
    const urlAsset = Asset.fromModule(SOUND_URIS[key]);
    await urlAsset.downloadAsync();
    const url = urlAsset.localUri || urlAsset.uri;
    await TrackPlayer.reset();
    await TrackPlayer.add({ id: key, url, title, artist: 'Slumbertone' });
    await TrackPlayer.setRepeatMode(RepeatMode.Track);
    await TrackPlayer.play();
  } catch (e) {
    console.warn('Android play failed:', e);
  }
}

export async function stopSound(mode = 'immediate', fadeMs = 900) {
  if (Platform.OS === 'ios') {
    if (!PerfectLoop) return;
    if (mode === 'fade') {
      try {
        // Simple JS fade on iOS
        const steps = 12;
        const start = 1.0;
        for (let i = 0; i < steps; i++) {
          const f = 1 - (i + 1) / steps;
          if (PerfectLoop.setVolume) await PerfectLoop.setVolume(f);
          await new Promise(r => setTimeout(r, fadeMs / steps));
        }
      } catch {}
    }
    try { await PerfectLoop.stop(); } catch {}
    try { if (PerfectLoop.setVolume) await PerfectLoop.setVolume(1.0); } catch {}
    return;
  }

  // Android
  try {
    if (mode === 'fade') {
      const steps = 12;
      const start = 1.0;
      for (let i = 0; i < steps; i++) {
        const f = 1 - (i + 1) / steps;
        await TrackPlayer.setVolume(f);
        await new Promise(r => setTimeout(r, fadeMs / steps));
      }
    }
  } catch {}
  try { await TrackPlayer.stop(); } catch {}
  try { await TrackPlayer.setVolume(1.0); } catch {}
}
