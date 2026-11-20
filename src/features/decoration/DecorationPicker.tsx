import { useEffect, useState } from 'react';
import {
  Animated,
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Sheep } from '../morning/types';
import { DecoratedSheepArt } from './DecoratedSheepArt';
import { theme } from '../../ui/theme';
export function DecorationPicker({
  items,
  onSelect,
  onBack,
}: {
  items: Sheep[];
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const [bounce] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let stopped = false,
      animation: Animated.CompositeAnimation | undefined;
    const run = (reduce: boolean) => {
      animation?.stop();
      bounce.setValue(0);
      if (!reduce && !stopped) {
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(bounce, {
              toValue: -4,
              duration: 550,
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bounce, {
              toValue: 0,
              duration: 550,
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
          { iterations: 2 },
        );
        animation.start();
      }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(run);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', run);
    return () => {
      stopped = true;
      sub.remove();
      animation?.stop();
    };
  }, [bounce]);
  return (
    <Modal
      testID="decoration-picker"
      visible
      transparent
      animationType="none"
      onRequestClose={onBack}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={s.dim} accessibilityViewIsModal>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="양 선택 닫기"
          onPress={onBack}
        />
        <View pointerEvents="box-none" style={s.content}>
          <Text accessibilityRole="header" style={s.toast}>
            꾸밀 양을 골라 주세요
          </Text>
          <ScrollView
            style={{ maxHeight: '70%' }}
            contentContainerStyle={s.grid}
          >
            {items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.night_date}의 양 꾸미기`}
                onPress={() => onSelect(item.id)}
                style={s.cell}
              >
                <Animated.View style={{ transform: [{ translateY: bounce }] }}>
                  <DecoratedSheepArt sheep={item} large />
                </Animated.View>
                <Text style={s.label}>{item.night_date}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: '#1E206399',
    justifyContent: 'center',
    padding: 20,
  },
  content: { gap: 30 },
  toast: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#2F3A9E',
    backgroundColor: '#FFF4D6',
    padding: 16,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#8C6E62',
    boxShadow: '4px 4px 0 #5A443B',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cell: {
    minWidth: 90,
    minHeight: 80,
    backgroundColor: '#E6EBFF40',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: '#242565',
    backgroundColor: '#F4F5FF',
    paddingHorizontal: 4,
    paddingVertical: 2,
    textAlign: 'center',
  },
});
