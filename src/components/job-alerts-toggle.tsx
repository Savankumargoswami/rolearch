"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/account/push-actions";
import { t } from "@/i18n";

type State = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

const toKey = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function registration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

/** Turns job-alert notifications on or off for this browser or installed app. */
export function JobAlertsToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const installed = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let next: Promise<State>;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      next = Promise.resolve(ios && !installed ? "ios-install" : "unsupported");
    } else if (Notification.permission === "denied") {
      next = Promise.resolve("blocked");
    } else {
      next = navigator.serviceWorker
        .getRegistration("/")
        .then((reg) => reg?.pushManager.getSubscription())
        .then((sub): State => (sub && Notification.permission === "granted" ? "on" : "off"))
        .catch((): State => "off");
    }
    next.then(setState);
  }, []);

  const turnOn = () =>
    start(async () => {
      setMessage("");
      try {
        if ((await Notification.requestPermission()) !== "granted") {
          setState(Notification.permission === "denied" ? "blocked" : "off");
          return;
        }
        const reg = await registration();
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
        const res = await savePushSubscription(sub.toJSON());
        if (!res.ok) {
          await sub.unsubscribe().catch(() => undefined);
          setMessage(t("jobAlerts.errSave"));
          return;
        }
        setState("on");
        setMessage(t("jobAlerts.saved"));
      } catch {
        setMessage(t("jobAlerts.errSave"));
      }
    });

  const turnOff = () =>
    start(async () => {
      setMessage("");
      try {
        const sub = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
        setMessage(t("jobAlerts.off"));
      } catch {
        setMessage(t("jobAlerts.errSave"));
      }
    });

  if (state === "loading") return <div className="mt-4 h-11" aria-hidden="true" />;
  if (state === "unsupported" || state === "ios-install" || state === "blocked") {
    const note = state === "unsupported" ? t("jobAlerts.unsupported") : state === "ios-install" ? t("jobAlerts.iosInstall") : t("jobAlerts.blocked");
    return <p className="mt-3 text-sm text-pretty">{note}</p>;
  }

  const on = state === "on";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        aria-pressed={on}
        onClick={on ? turnOff : turnOn}
        className={
          on
            ? "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-ink px-5 font-medium transition-[background-color,scale] duration-200 hover:bg-ink-soft active:scale-[0.96] disabled:cursor-default"
            : "inline-flex min-h-11 cursor-pointer items-center rounded-full bg-ink px-5 font-medium text-paper transition-[background-color,scale] duration-200 hover:bg-ink-hover active:scale-[0.96] disabled:cursor-default"
        }
      >
        {on ? t("jobAlerts.turnOff") : t("jobAlerts.turnOn")}
      </button>
      <p role="status" className="w-full text-sm text-muted empty:hidden">
        {message}
      </p>
    </div>
  );
}
