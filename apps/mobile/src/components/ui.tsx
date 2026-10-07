import { brandRoles, themeFor, type Brand, type Theme } from '@oathly/tokens';
import { createContext, useContext } from 'react';
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

import { useI18n } from '@/lib/i18n';

const BrandContext = createContext<Brand | null>(null);

/**
 * White-label: everything inside takes an organization's colours, in shades
 * that stay readable in the theme that is showing (see brandRoles).
 */
export function BrandProvider({
  brand,
  children,
}: {
  brand: Brand | null;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const brand = useContext(BrandContext);
  const theme = themeFor(scheme);
  if (!brand) return theme;
  return {
    ...theme,
    colors: { ...theme.colors, ...brandRoles(brand, scheme === 'dark' ? 'dark' : 'light') },
  };
}

/**
 * Lines the app's own text up with its language: on the right in Arabic,
 * even for a line that happens to be a Latin name. (Left to itself, each
 * line follows its own first letter.)
 */
function useTextAlign(): { textAlign: 'left' | 'right' } {
  return { textAlign: useI18n().direction === 'rtl' ? 'right' : 'left' };
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
  const align = useTextAlign();
  return (
    <Text
      accessibilityRole="header"
      style={[
        theme.text[level === 1 ? '4xl' : '2xl'],
        { color: theme.colors.fg, fontWeight: '600' },
        align,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted = false,
  size = 'base',
}: {
  children: React.ReactNode;
  muted?: boolean;
  size?: 'sm' | 'base' | 'lg';
}) {
  const theme = useTheme();
  const align = useTextAlign();
  return (
    <Text
      style={[theme.text[size], { color: muted ? theme.colors.fgMuted : theme.colors.fg }, align]}
    >
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
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent';
  disabled?: boolean;
  busy?: boolean;
  /** For automated tests (Maestro). */
  testID?: string;
}) {
  const theme = useTheme();
  const primary = variant !== 'secondary';
  const [fill, pressedFill, ink] =
    variant === 'accent'
      ? [theme.colors.accent, theme.colors.accentHover, theme.colors.onAccent]
      : [theme.colors.primary, theme.colors.primaryHover, theme.colors.onPrimary];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: theme.radii.md,
          backgroundColor: primary ? (pressed ? pressedFill : fill) : 'transparent',
          borderColor: theme.colors.borderStrong,
          borderWidth: primary ? 0 : 1,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? ink : theme.colors.fg} />
      ) : (
        <Text
          style={[theme.text.base, { fontWeight: '600', color: primary ? ink : theme.colors.fg }]}
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
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
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
  centered: { alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1 },
  choice: { minHeight: 44, paddingHorizontal: 16, borderWidth: 1, justifyContent: 'center' },
});

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          padding: theme.spacing[5],
          gap: theme.spacing[3],
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A quiet text button, for secondary actions inside cards. */
export function LinkButton({
  label,
  onPress,
  tone = 'default',
  testID,
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      testID={testID}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text
        style={[
          theme.text.base,
          {
            color: tone === 'danger' ? theme.colors.errorFg : theme.colors.primaryFg,
            fontWeight: '600',
            textDecorationLine: 'underline',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A whole-screen spinner, for the moment before the app knows who is signed in. */
export function LoadingScreen({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.fill, styles.centered, { backgroundColor: theme.colors.canvas }]}>
      <ActivityIndicator accessibilityLabel={label} color={theme.colors.primary} />
    </View>
  );
}
