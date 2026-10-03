import { themeFor, type Theme } from '@oathly/tokens';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function useTheme(): Theme {
  return themeFor(useColorScheme());
}

export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const theme = useTheme();
  const body = <View style={{ padding: theme.spacing[6], gap: theme.spacing[6] }}>{children}</View>;
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.canvas }]}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export function Heading({ children, level = 1 }: { children: React.ReactNode; level?: 1 | 2 }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[
        theme.text[level === 1 ? '4xl' : '2xl'],
        { color: theme.colors.fg, fontWeight: '600' },
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  const theme = useTheme();
  return (
    <Text style={[theme.text.base, { color: muted ? theme.colors.fgMuted : theme.colors.fg }]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: theme.radii.md,
          backgroundColor: primary
            ? pressed
              ? theme.colors.primaryHover
              : theme.colors.primary
            : 'transparent',
          borderColor: theme.colors.borderStrong,
          borderWidth: primary ? 0 : 1,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? theme.colors.onPrimary : theme.colors.fg} />
      ) : (
        <Text
          style={[
            theme.text.base,
            { fontWeight: '600', color: primary ? theme.colors.onPrimary : theme.colors.fg },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...input
}: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[1.5] }}>
      <Text style={[theme.text.sm, { color: theme.colors.fg, fontWeight: '500' }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={theme.colors.fgSubtle}
        style={[
          theme.text.base,
          styles.input,
          {
            color: theme.colors.fg,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
            borderRadius: theme.radii.sm,
          },
        ]}
        {...input}
      />
      {hint ? <Text style={[theme.text.sm, { color: theme.colors.fgMuted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          borderRadius: theme.radii.full,
          borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
          backgroundColor: selected ? theme.colors.primary : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          theme.text.base,
          { color: selected ? theme.colors.onPrimary : theme.colors.fg, fontWeight: '500' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Message({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        padding: theme.spacing[4],
        borderRadius: theme.radii.md,
        backgroundColor: tone === 'error' ? theme.colors.errorSoft : theme.colors.primarySoft,
      }}
    >
      <Text
        style={[
          theme.text.sm,
          { color: tone === 'error' ? theme.colors.errorFg : theme.colors.primaryFg },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  button: { minHeight: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1 },
  choice: { minHeight: 44, paddingHorizontal: 16, borderWidth: 1, justifyContent: 'center' },
});
