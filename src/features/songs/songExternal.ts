import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Track } from '../../api/contracts';
import type { SongExternalActions } from './types';
/** Use track metadata to keep searches on the intended Spotify HTTPS endpoint. */
export function spotifySearchUrl(track: Track) {
  const title = track.title.trim();
  const artist = track.artist.trim();
  if (!title || !artist) throw new Error('Missing track information');
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`;
}
export function trackCopyText(track: Track) {
  return `${track.title} · ${track.artist}`;
}
export const songExternal: SongExternalActions = {
  open: async (track) => {
    await Linking.openURL(spotifySearchUrl(track));
  },
  copy: async (track) => {
    if (!(await Clipboard.setStringAsync(trackCopyText(track))))
      throw new Error('Clipboard write failed');
  },
};
