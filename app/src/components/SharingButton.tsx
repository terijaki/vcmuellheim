import { Button } from "@mantine/core";
import { Share } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getCanNativeShare(): boolean {
  const title = document.title;
  const url = window.location.href;
  return !!navigator.canShare && navigator.canShare({ title, url });
}

export default function SharingButton(props: { label: string }) {
  const isNativeShare = useSyncExternalStore(subscribe, getCanNativeShare, () => false);

  const handleShare = () => {
    navigator
      .share({
        title: document.title,
        url: window.location.href,
      })
      .catch(() => {
        // Sharing cancellation or interruption is a non-fatal UX event.
      });
  };

  if (!isNativeShare) return null;

  return (
    <Button leftSection={<Share size={16} />} onClick={handleShare}>
      {props.label}
    </Button>
  );
}
