import { useEffect, useState } from "react";
import { View, Text, Pressable, BackHandler } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  Leaf,
  Home,
  Utensils,
  History as HistoryIcon,
  UserRound,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { AuthProvider, useAuth } from "./src/auth";
import { Login } from "./src/Login";
import { Meals } from "./src/Meals";
import { History } from "./src/History";
import { Profile, Settings } from "./src/Profile";
import { styles as s, colors } from "./src/theme";
import { Busy } from "./src/ui";
void SplashScreen.preventAutoHideAsync().catch(() => {});
const tabs = [
  ["home", "Home", Home],
  ["meals", "Meals", Utensils],
  ["history", "History", HistoryIcon],
  ["profile", "Profile", UserRound],
  ["settings", "Settings", SettingsIcon],
] as const;
function Navigator() {
  const auth = useAuth(),
    [tab, setTab] = useState<string>("home");
  useEffect(() => {
    if (!auth.loading) void SplashScreen.hideAsync();
  }, [auth.loading]);
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [tab]);
  if (auth.loading) return <Busy />;
  if (!auth.user) return <Login />;
  return (
    <View style={s.screen}>
      <View
        style={[
          s.between,
          {
            paddingHorizontal: 22,
            paddingVertical: 17,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            backgroundColor: "white",
          },
        ]}
      >
        <View style={s.row}>
          <Leaf size={22} color={colors.green} />
          <Text style={{ fontSize: 23, fontWeight: "700", color: colors.ink }}>
            MessMate.
          </Text>
        </View>
        <Text style={s.eyebrow}>STUDENT</Text>
      </View>
      <View style={{ flex: 1 }}>
        {tab === "home" ? (
          <Meals key="home" dashboard />
        ) : tab === "meals" ? (
          <Meals key="meals" />
        ) : tab === "history" ? (
          <History />
        ) : tab === "profile" ? (
          <Profile />
        ) : (
          <Settings />
        )}
      </View>
      <View style={s.tabbar} accessibilityRole="tablist">
        {tabs.map(([key, label, Icon]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            accessibilityLabel={label}
            onPress={() => setTab(key)}
            style={s.tab}
          >
            <Icon size={21} color={tab === key ? colors.green : colors.muted} />
            <Text
              style={[
                s.tabLabel,
                tab === key && { fontWeight: "700", color: colors.green },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.screen}>
        <StatusBar style="dark" />
        <AuthProvider>
          <Navigator />
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
