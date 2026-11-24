import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Native tokens always use the OS keystore. Web is a non-persistent development preview.
const preview = new Map<string, string>();
export const storage = {
  get: (key: string): Promise<string | null> =>
    Platform.OS === 'web'
      ? Promise.resolve(preview.get(key) ?? null)
      : SecureStore.getItemAsync(key),
  set: (key: string, value: string): Promise<void> =>
    Platform.OS === 'web'
      ? Promise.resolve(void preview.set(key, value))
      : SecureStore.setItemAsync(key, value),
  remove: (key: string): Promise<void> =>
    Platform.OS === 'web'
      ? Promise.resolve(void preview.delete(key))
      : SecureStore.deleteItemAsync(key),
};
