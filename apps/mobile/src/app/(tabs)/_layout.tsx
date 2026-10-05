import { Tabs } from 'expo-router';
import { View, type ColorValue } from 'react-native';

import { useTheme } from '@/components/ui';
import { useT } from '@/lib/i18n';

/** A plain marker for the tab bar: a dot that fills in for the current tab. */
function TabDot({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: color,
        backgroundColor: focused ? color : 'transparent',
      }}
    />
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primaryFg,
        tabBarInactiveTintColor: theme.colors.fgMuted,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        tabBarIcon: TabDot,
      }}
    >
      <Tabs.Screen
        name="study"
        options={{ title: t('profile.tabStudy'), tabBarButtonTestID: 'tab-study' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('profile.tabProfile'), tabBarButtonTestID: 'tab-profile' }}
      />
    </Tabs>
  );
}
