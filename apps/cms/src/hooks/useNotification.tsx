import { notifications } from "@mantine/notifications";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

type NotificationType = "success" | "error" | "neutral";

interface NotificationOptions {
	title?: string;
	message: string;
	duration?: number;
}

export const useNotification = () => {
	const show = (type: NotificationType, options: NotificationOptions) => {
		const { title, message } = options;

		const defaultDurations = {
			success: 3000,
			error: 5000,
			neutral: 3000,
		};

		const duration = options.duration ?? defaultDurations[type];

		const icons: Record<NotificationType, React.ElementType> = {
			success: CheckCircle,
			error: AlertCircle,
			neutral: Info,
		};

		const colors = {
			success: "green",
			error: "red",
			neutral: "blue",
		};

		const Icon = icons[type];

		notifications.show({
			title: title || (type === "error" ? "Fehler" : undefined),
			message,
			color: colors[type],
			icon: <Icon size={18} />,
			autoClose: duration,
		});
	};

	return {
		success: (options: Omit<NotificationOptions, "title"> | string) => {
			const opts = typeof options === "string" ? { message: options } : options;
			show("success", opts);
		},
		error: (options: NotificationOptions | string) => {
			const opts = typeof options === "string" ? { message: options } : options;
			show("error", { title: "Fehler", ...opts });
		},
		neutral: (options: NotificationOptions | string) => {
			const opts = typeof options === "string" ? { message: options } : options;
			show("neutral", opts);
		},
	};
};
