import { Capacitor } from '@capacitor/core';

/** True saat berjalan di dalam WebView Android/iOS, false saat di browser. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isWeb(): boolean {
  return !Capacitor.isNativePlatform();
}

/** 'web' | 'android' | 'ios' */
export function platformName(): string {
  return Capacitor.getPlatform();
}
