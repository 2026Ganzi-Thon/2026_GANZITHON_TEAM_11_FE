import { it, expect, jest, afterEach } from '@jest/globals';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { songExternal, spotifySearchUrl, trackCopyText } from './songExternal';
const track = {
  id: 't',
  title: '밤 & 쉼 / 1',
  artist: '가수 이름',
  cover_url: null,
  spotify_search_url: 'javascript:bad',
};
afterEach(() => {
  jest.restoreAllMocks();
});
it('constructs a Spotify HTTPS search for the exact title and artist without trusting arbitrary URLs', async () => {
  const url = spotifySearchUrl(track);
  expect(new URL(url).origin).toBe('https://open.spotify.com');
  expect(decodeURIComponent(new URL(url).pathname)).toBe(
    '/search/밤 & 쉼 / 1 가수 이름',
  );
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await songExternal.open(track);
  expect(open).toHaveBeenCalledWith(url);
});
it('copies only track metadata and propagates clipboard failure', async () => {
  const copy = jest
    .spyOn(Clipboard, 'setStringAsync')
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);
  await songExternal.copy(track);
  expect(copy).toHaveBeenCalledWith(trackCopyText(track));
  expect(trackCopyText(track)).toBe('밤 & 쉼 / 1 · 가수 이름');
  await expect(songExternal.copy(track)).rejects.toThrow(
    'Clipboard write failed',
  );
});
