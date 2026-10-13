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

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isFormValid = email.trim().length > 0 && password.length > 0;

  const onSubmit = async () => {
    if (!isFormValid || submitting) return;
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Veuillez saisir une adresse email valide.");
      emailRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? "Email ou mot de passe incorrect."
            : "Connexion impossible pour le moment."
          : `Serveur injoignable (${API_URL})`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Ravi de vous revoir"
      subtitle="Connectez-vous pour retrouver vos cercles et vos partages."
      badge="Espace sécurisé"
      seoTitle="Connexion • Orbit"
      seoDescription="Connectez-vous à Orbit pour partager votre position en direct de manière temporaire et consentie."
    >
      <AuthRow index={0}>
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
          accessibilityHint="Saisissez l'adresse email associée à votre compte"
        />
      </AuthRow>

      <AuthRow index={1}>
        <TextField
          ref={passwordRef}
          dark
          label="Mot de passe"
          icon="lock-closed-outline"
          placeholder="Votre mot de passe"
          secureTextEntry
          showPasswordToggle
          autoComplete="current-password"
          returnKeyType="go"
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            if (error) setError(null);
          }}
          onSubmitEditing={onSubmit}
          accessibilityLabel="Mot de passe"
          accessibilityHint="Saisissez votre mot de passe pour vous connecter"
        />
      </AuthRow>

      {error && (
        <AuthRow index={2}>
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

      <AuthRow index={3}>
        <Button
          size="lg"
          label={submitting ? "Connexion en cours…" : "Se connecter"}
          icon="arrow-forward"
          loading={submitting}
          disabled={!isFormValid || submitting}
          onPress={onSubmit}
          style={styles.button}
          accessibilityLabel="Bouton Se connecter"
        />
      </AuthRow>

      <AuthRow index={4}>
        <GoogleButton onError={setError} />
      </AuthRow>

      <AuthRow index={5}>
        <View style={styles.footerLinks}>
          <Link href="/(auth)/register" style={styles.link}>
            <AppText variant="body" color={colors.onNightMuted}>
              Pas encore de compte ?{" "}
              <AppText variant="bodyStrong" color={colors.cyan} style={styles.registerLink}>
                Créer un compte
              </AppText>
            </AppText>
          </Link>
        </View>
      </AuthRow>

      {/* Trust reassurance pills */}
      <AuthRow index={6}>
        <View style={styles.trustBadgesRow}>
          <View style={styles.trustBadge}>
            <Ionicons name="shield-checkmark" size={13} color={colors.cyan} />
            <AppText variant="caption" color={colors.onNightMuted}>
              Chiffré SSL
            </AppText>
          </View>
          <View style={styles.trustBadgeDot} />
          <View style={styles.trustBadge}>
            <Ionicons name="location-outline" size={13} color={colors.cyan} />
            <AppText variant="caption" color={colors.onNightMuted}>
              Zéro tracking permanent
            </AppText>
          </View>
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
  registerLink: {
    textDecorationLine: Platform.OS === "web" ? "underline" : "none",
  },
  trustBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    opacity: 0.85,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  trustBadgeDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.onNightMuted,
    opacity: 0.5,
  },
});
