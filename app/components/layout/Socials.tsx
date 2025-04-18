import { FaMastodon as IconMastodon, FaFacebook as IconFacebook, FaInstagram as IconInstagram, FaWhatsapp as IconWhatsApp } from "react-icons/fa6";

export default function socialList() {
	const socials = [
		{ name: "Mastodon", href: "https://freiburg.social/@VCM", icon: <IconMastodon />, target: "_blank", rel: "noreferrer" },
		{ name: "Instagram", href: "https://www.instagram.com/vcmuellheim", icon: <IconInstagram />, target: "_blank", rel: "noreferrer" },
		{ name: "Facebook", href: "https://www.facebook.com/VCMuellheim/", icon: <IconFacebook />, target: "_blank", rel: "noreferrer" },
	];
	return socials;
}
