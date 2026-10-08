import { useRef, useState } from "react";
import { StyleSheet, type TextInput } from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "../../lib/auth-store";
import { ApiError } from "../../lib/api-client";
import { API_URL } from "../../constants/config";
import { AuthLayout, AuthRow } from "../../components/AuthLayout";
import { AppText, Button, TextField } from "../../components/ui";
import { colors } from "../../theme";

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères");
      return;
    }
    setSubmitting(true);
    try {
      await register({ displayName: displayName.trim(), email: email.trim().toLowerCase(), password });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 409
            ? "Un compte existe déjà avec cet email"
            : "Inscription impossible"
          : `Serveur injoignable (${API_URL})`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Bienvenue" subtitle="Crée ton compte en 20 secondes.">
      <AuthRow index={0}>
        <TextField
          dark
          icon="person"
          placeholder="Prénom ou pseudo"
          autoComplete="given-name"
          returnKeyType="next"
          value={displayName}
          onChangeText={setDisplayName}
          onSubmitEditing={() => emailRef.current?.focus()}
        />
      </AuthRow>
      <AuthRow index={1}>
        <TextField
          ref={emailRef}
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
      <AuthRow index={2}>
        <TextField
          ref={passwordRef}
          dark
          icon="lock-closed"
          placeholder="Mot de passe (8 caractères min.)"
          secureTextEntry
          autoComplete="new-password"
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
      <AuthRow index={3}>
        <Button
          size="lg"
          label="Créer mon compte"
          loading={submitting}
          disabled={!email || !password || !displayName}
          onPress={onSubmit}
          style={styles.button}
        />
      </AuthRow>
      <AuthRow index={4}>
        <Link href="/(auth)/login" style={styles.link}>
          <AppText variant="body" color={colors.onNightMuted}>
            Déjà un compte ? <AppText variant="bodyStrong" color={colors.cyan}>Se connecter</AppText>
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
