import {
	FaFacebook as IconFacebook,
	FaInstagram as IconInstagram,
	FaMastodon as IconMastodon,
	FaWhatsapp as IconWhatsApp,
} from "react-icons/fa6";

export default function socialList() {
	const socials = [
		{
			name: "Mastodon",
			href: "https://freiburg.social/@VCM",
			icon: <IconMastodon />,
			target: "_blank",
			rel: "noreferrer",
		},
		{
			name: "Instagram",
			href: "https://www.instagram.com/vcmuellheim",
			icon: <IconInstagram />,
			target: "_blank",
			rel: "noreferrer",
		},
		{
			name: "Facebook",
			href: "https://www.facebook.com/VCMuellheim/",
			icon: <IconFacebook />,
			target: "_blank",
			rel: "noreferrer",
		},
		{
			name: "WhatsApp",
			href: "https://whatsapp.com/channel/0029VaE5QwVGJP8GijYi1N36",
			icon: <IconWhatsApp />,
			target: "_blank",
			rel: "noreferrer",
		},
	];
	return socials;
}
