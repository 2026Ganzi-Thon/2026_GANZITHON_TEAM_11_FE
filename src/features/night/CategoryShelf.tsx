import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { categories } from './categories';
import type { CategoryId } from './entry';
import { theme } from '../../ui/theme';

export function CategoryShelf({
  value,
  disabled,
  onChange,
}: {
  value: CategoryId | null;
  disabled: boolean;
  onChange: (value: CategoryId) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.shelf}>
        <View style={styles.frame} pointerEvents="none" />
        <View style={styles.books}>
          {categories.map((category) => {
            const selected = value === category.id;
            return (
              <Pressable
                key={category.id}
                accessibilityRole="radio"
                accessibilityLabel={category.label}
                accessibilityState={{ selected, checked: selected, disabled }}
                disabled={disabled}
                onPress={() => onChange(category.id)}
                style={styles.target}
              >
                <View
                  style={[
                    styles.book,
                    {
                      height: selected ? 196 : category.height,
                      backgroundColor: category.color,
                      opacity: value && !selected ? 0.55 : 1,
                      transform: [{ translateY: selected ? 12 : 0 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.topStripe,
                      { backgroundColor: category.stripe },
                    ]}
                  />
                  <View
                    style={[
                      styles.topLine,
                      { backgroundColor: category.stripe },
                    ]}
                  />
                  <View style={styles.label}>
                    <View
                      style={[styles.dot, { backgroundColor: category.color }]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.name,
                      category.id === 'other' && { color: theme.color.text },
                    ]}
                  >
                    {category.label.replaceAll(' ', '').split('').join('\n')}
                  </Text>
                  <View
                    style={[
                      styles.bottomLine,
                      { backgroundColor: category.stripe },
                    ]}
                  />
                  <View
                    style={[
                      styles.bottomStripe,
                      { backgroundColor: category.stripe },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
        <View pointerEvents="none" style={styles.ledge} />
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, minWidth: 320 },
  shelf: {
    flex: 1,
    height: 212,
    paddingHorizontal: 8,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  frame: {
    position: 'absolute',
    top: 8,
    bottom: 20,
    left: 0,
    right: 0,
    borderWidth: 6,
    borderBottomWidth: 0,
    borderColor: '#2E3E9E',
    backgroundColor: 'rgba(27,28,85,0.55)',
  },
  books: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, zIndex: 1 },
  target: {
    flex: 1,
    minHeight: 196,
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  book: { width: '100%', alignItems: 'center' },
  topStripe: { position: 'absolute', top: 0, width: '100%', height: 6 },
  topLine: { position: 'absolute', top: 10, width: '100%', height: 2 },
  bottomStripe: { position: 'absolute', bottom: 0, width: '100%', height: 8 },
  bottomLine: { position: 'absolute', bottom: 12, width: '100%', height: 2 },
  label: {
    marginTop: 18,
    width: 14,
    height: 14,
    backgroundColor: theme.color.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 6, height: 6 },
  name: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 15,
    includeFontPadding: false,
    fontWeight: '700',
    color: theme.color.background,
    textAlign: 'center',
    marginTop: 8,
  },
  ledge: {
    position: 'absolute',
    left: -4,
    right: -4,
    bottom: 12,
    height: 10,
    borderTopWidth: 2,
    borderTopColor: '#5B6BC8',
    borderBottomWidth: 3,
    borderBottomColor: '#172066',
    backgroundColor: '#3B4FB8',
  },
});
