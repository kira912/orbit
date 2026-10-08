import { useRef, useState } from "react";
import { StyleSheet, type TextInput } from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "../../lib/auth-store";
import { ApiError } from "../../lib/api-client";
import { API_URL } from "../../constants/config";
import { AuthLayout, AuthRow } from "../../components/AuthLayout";
import { AppText, Button, TextField } from "../../components/ui";
import { colors } from "../../theme";

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? "Email ou mot de passe incorrect"
            : "Connexion impossible"
          : `Serveur injoignable (${API_URL})`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Orbit" subtitle="Partage ton trajet le temps qu'il faut, puis ça s'arrête tout seul.">
      <AuthRow index={0}>
        <TextField
          dark
          icon="mail"
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      </AuthRow>
      <AuthRow index={1}>
        <TextField
          ref={passwordRef}
          dark
          icon="lock-closed"
          placeholder="Mot de passe"
          secureTextEntry
          autoComplete="password"
          returnKeyType="go"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onSubmit}
        />
      </AuthRow>
      {error && (
        <AppText variant="bodyStrong" color="#FCA5A5" align="center">
          {error}
        </AppText>
      )}
      <AuthRow index={2}>
        <Button
          size="lg"
          label="Se connecter"
          loading={submitting}
          disabled={!email || !password}
          onPress={onSubmit}
          style={styles.button}
        />
      </AuthRow>
      <AuthRow index={3}>
        <Link href="/(auth)/register" style={styles.link}>
          <AppText variant="body" color={colors.onNightMuted}>
            Pas encore de compte ? <AppText variant="bodyStrong" color={colors.cyan}>Créer un compte</AppText>
          </AppText>
        </Link>
      </AuthRow>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  button: { marginTop: 6 },
  link: { textAlign: "center", marginTop: 8 },
});
