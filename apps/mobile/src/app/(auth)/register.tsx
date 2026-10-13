import { useRef, useState } from "react";
import { Platform, StyleSheet, View, type TextInput } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../lib/auth-store";
import { ApiError } from "../../lib/api-client";
import { API_URL } from "../../constants/config";
import { AuthLayout, AuthRow } from "../../components/AuthLayout";
import { GoogleButton } from "../../components/GoogleButton";
import { AppText, Button, TextField } from "../../components/ui";
import { colors, radius } from "../../theme";

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isFormValid = displayName.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  const onSubmit = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      passwordRef.current?.focus();
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Veuillez saisir une adresse email valide.");
      emailRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await register({ displayName: displayName.trim(), email: trimmedEmail, password });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 409
            ? "Un compte existe déjà avec cet email."
            : "Inscription impossible pour le moment."
          : `Serveur injoignable (${API_URL})`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Rejoignez Orbit en quelques secondes et partagez en toute sérénité."
      badge="Gratuit & sécurisé"
      seoTitle="Inscription • Orbit"
      seoDescription="Créez votre compte Orbit pour partager vos trajets en direct sans tracking permanent."
    >
      <AuthRow index={0}>
        <TextField
          dark
          label="Prénom ou pseudo"
          icon="person-outline"
          placeholder="Ex : Camille"
          autoComplete="given-name"
          returnKeyType="next"
          value={displayName}
          onChangeText={(val) => {
            setDisplayName(val);
            if (error) setError(null);
          }}
          onSubmitEditing={() => emailRef.current?.focus()}
          accessibilityLabel="Prénom ou pseudo"
          accessibilityHint="Saisissez votre prénom ou pseudo visible par vos cercles"
        />
      </AuthRow>

      <AuthRow index={1}>
        <TextField
          ref={emailRef}
          dark
          label="Adresse email"
          icon="mail-outline"
          placeholder="nom@exemple.com"
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          keyboardType="email-address"
          returnKeyType="next"
          value={email}
          onChangeText={(val) => {
            setEmail(val);
            if (error) setError(null);
          }}
          onSubmitEditing={() => passwordRef.current?.focus()}
          accessibilityLabel="Adresse email"
          accessibilityHint="Saisissez votre adresse email"
        />
      </AuthRow>

      <AuthRow index={2}>
        <TextField
          ref={passwordRef}
          dark
          label="Mot de passe"
          icon="lock-closed-outline"
          placeholder="Au moins 8 caractères"
          secureTextEntry
          showPasswordToggle
          autoComplete="new-password"
          returnKeyType="go"
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            if (error) setError(null);
          }}
          onSubmitEditing={onSubmit}
          helperText="8 caractères minimum recommandés"
          accessibilityLabel="Mot de passe"
          accessibilityHint="Saisissez un mot de passe sécurisé d'au moins 8 caractères"
        />
      </AuthRow>

      {error && (
        <AuthRow index={3}>
          <View
            style={styles.errorBox}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            <Ionicons name="alert-circle" size={18} color="#EF4444" style={styles.errorIcon} />
            <AppText variant="caption" color="#FCA5A5" style={styles.errorText}>
              {error}
            </AppText>
          </View>
        </AuthRow>
      )}

      <AuthRow index={4}>
        <Button
          size="lg"
          label={submitting ? "Création en cours…" : "Créer mon compte"}
          icon="sparkles-outline"
          loading={submitting}
          disabled={!isFormValid || submitting}
          onPress={onSubmit}
          style={styles.button}
          accessibilityLabel="Bouton Créer mon compte"
        />
      </AuthRow>

      <AuthRow index={5}>
        <GoogleButton onError={setError} />
      </AuthRow>

      <AuthRow index={6}>
        <View style={styles.footerLinks}>
          <Link href="/(auth)/login" style={styles.link}>
            <AppText variant="body" color={colors.onNightMuted}>
              Déjà un compte ?{" "}
              <AppText variant="bodyStrong" color={colors.cyan} style={styles.loginLink}>
                Se connecter
              </AppText>
            </AppText>
          </Link>
        </View>
      </AuthRow>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  errorIcon: {
    flexShrink: 0,
  },
  errorText: {
    flex: 1,
    lineHeight: 18,
  },
  footerLinks: {
    marginTop: 10,
    alignItems: "center",
  },
  link: {
    textAlign: "center",
    paddingVertical: 6,
  },
  loginLink: {
    textDecorationLine: Platform.OS === "web" ? "underline" : "none",
  },
});
