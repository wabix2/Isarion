import { useSignIn, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Link, router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const colors = useColors();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  const isLoading = fetchStatus === "fetching";

  const completeSignIn = useCallback(async () => {
    await signIn.finalize({
      navigate: ({ session }) => {
        if (session?.currentTask) return;
        router.replace("/");
      },
    });
  }, [signIn]);

  const handleSubmit = async () => {
    if (!emailAddress.trim() || !password) return;
    setMessage("");
    try {
      const result = await signIn.password({
        emailAddress: emailAddress.trim(),
        password,
      });
      if (result.error) {
        setMessage(result.error.message ?? "We couldn't sign you in. Check your details and try again.");
        return;
      }
      if (signIn.status === "complete") {
        await completeSignIn();
      } else if (signIn.status === "needs_second_factor") {
        setMessage("Additional verification is required for this account.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't sign you in. Check your details and try again.");
    }
  };

  const handleGoogle = async () => {
    setMessage("");
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      console.log(
        `[auth] Google sign-in session=${Boolean(createdSessionId)} setActive=${Boolean(setActive)}`,
      );
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
      } else {
        setMessage("Google sign-in did not create an active session. Check the Clerk Google connection and try again.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sign-in was cancelled or unavailable.");
    }
  };

  return (
    <AuthShell colors={colors}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>ISARION</Text>
      <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Pick up where your learning streak left off.
      </Text>

      <AuthButton label="Continue with Google" onPress={handleGoogle} disabled={isLoading} colors={colors} secondary />
      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.textMuted }]}>or use email</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Email address</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
        value={emailAddress}
        onChangeText={setEmailAddress}
        placeholder="you@example.com"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        textContentType="password"
      />
      <AuthButton
        label={isLoading ? "Signing in…" : "Sign in"}
        onPress={handleSubmit}
        disabled={!emailAddress.trim() || !password || isLoading}
        colors={colors}
      />
      {!!errors.fields.identifier?.message && <AuthError message={errors.fields.identifier.message} colors={colors} />}
      {!!errors.fields.password?.message && <AuthError message={errors.fields.password.message} colors={colors} />}
      {!!message && <AuthError message={message} colors={colors} />}

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>New to Isarion?</Text>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable>
            <Text style={[styles.link, { color: colors.primary }]}>Create an account</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}

function AuthShell({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.logo, { backgroundColor: colors.primary + "22" }]}>
          <Image source={require("../../assets/images/icon.png")} style={styles.logoImage} />
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AuthButton({
  label,
  onPress,
  disabled,
  colors,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  colors: ReturnType<typeof useColors>;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: secondary ? colors.card : colors.primary, borderColor: secondary ? colors.border : colors.primary },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, { color: secondary ? colors.text : colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

function AuthError({ message, colors }: { message: string; colors: ReturnType<typeof useColors> }) {
  return <Text style={[styles.error, { color: colors.destructive }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 72, paddingBottom: 36 },
  logo: { width: 56, height: 56, borderRadius: 18, overflow: "hidden", marginBottom: 28 },
  logoImage: { width: "100%", height: "100%" },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 2, marginBottom: 10 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.6, marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 28 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 16 },
  button: { minHeight: 54, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 20 },
  buttonText: { fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }] },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 28 },
  footerText: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: "800" },
  textButton: { alignItems: "center", marginTop: 18, padding: 8 },
  error: { fontSize: 13, lineHeight: 19, marginTop: 10 },
});
