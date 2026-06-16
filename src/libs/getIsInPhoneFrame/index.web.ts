import variables from '@styles/variables';

/**
 * Whether the app is rendering inside the desktop-web "phone frame" (issue
 * #1219).
 *
 * On web above the responsive breakpoint the app renders inside a centered
 * ~480px "phone frame" (web/index.html + index.web.js), which clamps the
 * reported window width to the frame so the existing mobile layout is reused.
 * That clamp makes the app permanently report a small-screen width, so
 * `isSmallScreenWidth` can no longer tell a genuinely narrow browser apart from
 * the desktop phone frame (both report ~480px).
 *
 * Read the *real* (unclamped) viewport width straight from `window.innerWidth`
 * to recover that distinction. Keep the breakpoint in sync with the `BREAKPOINT`
 * constant in index.web.js and `variables.mobileResponsiveWidthBreakpoint`.
 */
export default function getIsInPhoneFrame(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.innerWidth > variables.mobileResponsiveWidthBreakpoint
  );
}
