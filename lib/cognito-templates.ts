import { type UserVerificationConfig, VerificationEmailStyle } from "aws-cdk-lib/aws-cognito";
import { Club } from "../project.config";

export function getCognitoEmailTemplates(cmsDomain: string): { userInvitation: UserVerificationConfig; userVerification: UserVerificationConfig } {
	const loginUrl = `https://${cmsDomain}`;

	return {
		userInvitation: {
			emailSubject: `Einladung zum ${Club.shortName} CMS`,
			emailBody: `<p>Hallo 👋,</p>

<p>du wurdest zum ${Club.shortName} Content Management System eingeladen!</p>
<p>Um dein Konto zu aktivieren, folge bitte diesen Schritten:</p>
<ol>
<li>Öffne die Login-Seite: ${loginUrl}</li>
<li>Gib deine E-Mail-Adresse ein: {username}</li>
<li>Logge dich mit diesem temporären Passwort ein: <b>{####}</b></li>
<li>Du wirst beim ersten Login aufgefordert, dein Passwort zu ändern.</li>
</ol>
<p>Bei Fragen wende dich bitte an den Administrator.</p>
<p>Sportliche Grüße,<br>${Club.shortName}</p>`,
			emailStyle: VerificationEmailStyle.LINK,
		},
		userVerification: {
			emailSubject: `${Club.shortName} - E-Mail bestätigen`,
			emailBody: `<p>Hallo 👋,</p>
	<p>vielen Dank für deine Registrierung beim ${Club.shortName} CMS.</p>
	<p>Bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:<br>{##E-Mail bestätigen##}</p>
	<p>Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.</p>
	<p>Sportliche Grüße,<br>${Club.shortName}</p>`,
			emailStyle: VerificationEmailStyle.LINK,
		},
	};
}

// <p>Alternativ kannst du auch das temporäre Passwort <b>{####}</b> verwenden und beim ersten Login ein neues Passwort festlegen.</p>
