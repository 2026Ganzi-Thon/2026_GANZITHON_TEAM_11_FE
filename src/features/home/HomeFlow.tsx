import type { HomeSource } from './types';
import { fortuneDate, type HomeSnapshot } from './model';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeTime } from './HomeTime';
import { FirstNightHome } from './FirstNightHome';
import { HomeNightButton } from './HomeNightButton';
import { MorningScreen } from '../morning/MorningScreen';
export function HomeFlow(props: {
  source: HomeSource;
  onNight: (snapshot: HomeSnapshot) => void;
  onExit: () => void;
}) {
  const [current, setCurrent] = useState({ source: props.source, version: 0 });
  const morning = useMemo(
    () => ({
      ...props.source.morning,
      fortune: props.source.fortune,
      settings: props.source.settings ?? props.source.morning.settings,
    }),
    [props.source],
  );
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
          <MorningScreen
            fortuneKey={fortuneDate(Date.parse(flow.snapshot.server_time))}
            homeWhenNoCandidates
            actions={morning}
            myCards={props.source.cards}
            loadDetail={props.source.loadDetail}
            onExit={props.onExit}
            homeFooter={(blocked) => (
              <HomeNightButton flow={flow} blocked={blocked} />
            )}
          />
        )
      }
    </HomeTime>
  );
}
const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#D8DFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
