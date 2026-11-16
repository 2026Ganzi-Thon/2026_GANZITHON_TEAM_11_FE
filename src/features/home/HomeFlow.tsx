import type { HomeSource } from './types';
import { fortuneDate, type HomeSnapshot } from './model';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeTime } from './HomeTime';
import type { HomeContext } from './useHomeContext';
import { FirstNightHome } from './FirstNightHome';
import { HomeNightButton } from './HomeNightButton';
import { MorningScreen } from '../morning/MorningScreen';
export function HomeFlow(props: {
  source: HomeSource;
  onNight: (snapshot: HomeSnapshot) => void;
  onExit: () => void;
}) {
  const [current, setCurrent] = useState({ source: props.source, version: 0 });
  if (current.source !== props.source)
    setCurrent({ source: props.source, version: current.version + 1 });
  return (
    <HomeTime
      key={current.version}
      actions={props.source.clock}
      onNight={props.onNight}
    >
      {(flow) =>
        !flow.snapshot ? (
          <SafeAreaView style={styles.loading}>
            <View style={styles.center}>
              {flow.pending && (
                <ActivityIndicator
                  accessibilityLabel="홈 불러오는 중"
                  color="#2F3A9E"
                />
              )}
            </View>
            <HomeNightButton flow={flow} />
          </SafeAreaView>
        ) : flow.snapshot.user.stats.night_count === 0 ? (
          <FirstNightHome
            source={props.source}
            flow={flow}
            onExit={props.onExit}
          />
        ) : (
          <MorningHome
            source={props.source}
            flow={flow}
            onExit={props.onExit}
          />
        )
      }
    </HomeTime>
  );
}
function MorningHome({
  source,
  flow,
  onExit,
}: {
  source: HomeSource;
  flow: HomeContext;
  onExit: () => void;
}) {
  const snapshot = flow.snapshot!;
  const date = fortuneDate(Date.parse(snapshot.server_time));
  const selected = useMemo(
    () => source.resolveMorning?.(snapshot) ?? source.morning,
    [source, snapshot],
  );
  const morning = useMemo(
    () => ({
      ...selected,
      fortune: source.fortune,
      settings: source.settings ?? selected.settings,
    }),
    [source, selected],
  );
  return (
    <MorningScreen
      fortuneKey={date}
      homeWhenNoCandidates
      actions={morning}
      myCards={source.cards}
      loadDetail={source.loadDetail}
      onExit={onExit}
      homeFooter={(blocked) => (
        <HomeNightButton flow={flow} blocked={blocked} />
      )}
    />
  );
}
const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#D8DFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
