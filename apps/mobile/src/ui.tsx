import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { styles as s, colors } from "./theme";
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[
        s.button,
        secondary && s.secondary,
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>
    </Pressable>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
export function Badge({ text }: { text: string }) {
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{text}</Text>
    </View>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <View style={s.error} accessibilityLiveRegion="polite">
      <Text style={s.errorText}>{message}</Text>
    </View>
  ) : null;
}
export function Busy() {
  return (
    <View style={s.empty} accessibilityLabel="Loading">
      <ActivityIndicator size="large" color={colors.green} />
      <Text style={s.body}>Connecting to your campus…</Text>
    </View>
  );
}
