import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Leaf } from "lucide-react-native";
import { useAuth } from "./auth";
import { Button, ErrorNotice } from "./ui";
import { styles as s, colors } from "./theme";
export function Login() {
  const auth = useAuth();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.screen}
    >
      <ScrollView
        contentContainerStyle={[
          s.content,
          { flexGrow: 1, justifyContent: "center" },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            s.card,
            { backgroundColor: colors.ink, padding: 27, marginBottom: 14 },
          ]}
        >
          <Leaf size={29} color={colors.lime} />
          <Text style={{ fontSize: 32, fontWeight: "700", color: "white" }}>
            MessMate.
          </Text>
          <Text style={{ color: "#c6d8bb", fontSize: 17, lineHeight: 25 }}>
            A little planning. A better meal for everyone.
          </Text>
        </View>
        <Text style={s.title}>Welcome back.</Text>
        <Text style={s.body}>Sign in with your campus account.</Text>
        <ErrorNotice message={error || auth.error} />
        <View>
          <Text style={s.label}>Email address</Text>
          <TextInput
            accessibilityLabel="Email address"
            style={s.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username"
          />
        </View>
        <View>
          <Text style={s.label}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            style={s.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
          />
        </View>
        <Button
          title={busy ? "Signing in…" : "Sign in"}
          disabled={busy || !email || !password}
          onPress={() => {
            setBusy(true);
            setError("");
            auth
              .login(email.trim(), password)
              .catch((e) =>
                setError(e instanceof Error ? e.message : "Sign in failed."),
              )
              .finally(() => setBusy(false));
          }}
        />
        <Text style={[s.body, { fontSize: 12, textAlign: "center" }]}>
          Need an account? Contact your mess administrator.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
