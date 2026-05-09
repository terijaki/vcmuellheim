import { Alert, Button, PinInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import type { EMAIL_OTP_ERROR_CODES } from "better-auth/client/plugins";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";

const OTP_ERROR_MESSAGES = {
  OTP_EXPIRED: "Der Anmeldecode ist abgelaufen. Bitte fordere einen neuen Code an.",
  INVALID_OTP: "Ungültiger Code. Bitte überprüfe deine Eingabe.",
  TOO_MANY_ATTEMPTS: "Zu viele Versuche. Bitte fordere einen neuen Code an.",
} satisfies Record<keyof typeof EMAIL_OTP_ERROR_CODES, string>;

export interface LoginFormProps {
  redirectTo?: "/admin";
}

export function LoginForm({ redirectTo = "/admin" }: LoginFormProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sendOtp = async (targetEmail: string) => {
    const normalizedEmail = targetEmail.trim().toLowerCase();
    await authClient.emailOtp.sendVerificationOtp({
      email: normalizedEmail,
      type: "sign-in",
    });
    return normalizedEmail;
  };

  const handleSendOtp = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const normalizedEmail = await sendOtp(email);
      setOtp("");
      setOtpEmail(normalizedEmail);
      setOtpSent(true);
      setInfo(
        `Wenn die E-Mail-Adresse (${normalizedEmail}) registriert ist, wurde ein Anmeldecode verschickt.`,
      );
    } catch {
      setError("Der Anmeldecode konnte gerade nicht angefordert werden. Bitte versuche es erneut.");
    }

    setSubmitting(false);
  };

  const handleVerifyOtp = async (otpValue = otp) => {
    if (!otpEmail || otpValue.length < 6) return;
    setSubmitting(true);
    setError(null);

    const result = await authClient.signIn.emailOtp({
      email: otpEmail,
      otp: otpValue,
    });

    if (result.error) {
      const code = result.error.code;
      const message =
        code && code in OTP_ERROR_MESSAGES
          ? OTP_ERROR_MESSAGES[code as keyof typeof OTP_ERROR_MESSAGES]
          : "Ungültiger Code";
      setError(message);
      setSubmitting(false);
      return;
    }

    await navigate({ to: redirectTo });
  };

  return (
    <Stack gap="md" miw={360} maw={500} p="xl">
      <Title order={2} ta="center">
        VC Müllheim Anmeldung
      </Title>

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}
      {info && (
        <Alert color="blue" variant="light">
          {info}
        </Alert>
      )}

      {!otpSent ? (
        <>
          <Text c="dimmed" ta="center" size="sm">
            Gib deine E-Mail-Adresse ein, um einen Anmeldecode zu erhalten.
          </Text>
          <TextInput
            label="E-Mail-Adresse"
            placeholder="erika@example.com"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            onKeyDown={(event) => event.key === "Enter" && void handleSendOtp()}
            type="email"
            disabled={submitting}
            autoFocus
          />
          <Button
            onClick={() => void handleSendOtp()}
            loading={submitting}
            disabled={!email.trim()}
            fullWidth
          >
            Anmeldecode senden
          </Button>
        </>
      ) : (
        <>
          <Text c="dimmed" ta="center" size="sm">
            Bitte gib den 6-stelligen Code ein, der dir zugeschickt wurde.
          </Text>
          <Stack align="center" gap="md">
            <PinInput
              length={6}
              type="number"
              value={otp}
              onChange={setOtp}
              onComplete={(value) => void handleVerifyOtp(value)}
              disabled={submitting}
              error={!!error}
              autoFocus
              oneTimeCode
              inputMode="numeric"
              ariaLabel="Anmeldecode"
              fw="bolder"
              placeholder="_"
              size="md"
            />
          </Stack>
          <Button
            onClick={() => void handleVerifyOtp()}
            loading={submitting}
            disabled={otp.length < 6}
            fullWidth
          >
            Anmelden
          </Button>
          <Button
            variant="subtle"
            color="gray"
            onClick={() => {
              setOtpSent(false);
              setOtp("");
              setError(null);
              setInfo(null);
              setEmail(otpEmail || "");
            }}
            disabled={submitting}
          >
            Neu versuchen
          </Button>
        </>
      )}
    </Stack>
  );
}
