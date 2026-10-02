import { hello } from '@oathly/core';
import { spacing, themeFor } from '@oathly/tokens';
import { StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const theme = themeFor(useColorScheme());

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <Text
        accessibilityRole="header"
        style={[theme.text['2xl'], styles.title, { color: theme.colors.fg }]}
      >
        {hello()}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  title: {
    fontWeight: '600',
  },
});
