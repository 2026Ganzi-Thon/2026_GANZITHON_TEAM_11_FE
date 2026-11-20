import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from './session';
const key = 'yangsebam.auth.v1';
export const tokenStore: TokenStore = {
  async read() {
    const value = await SecureStore.getItemAsync(key);
    return value ? JSON.parse(value) : null;
  },
  async write(value) {
    if (value) await SecureStore.setItemAsync(key, JSON.stringify(value));
    else await SecureStore.deleteItemAsync(key);
  },
};
