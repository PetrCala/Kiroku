/**
 * Whether the app is rendering inside the desktop-web "phone frame" (issue
 * #1219). The phone frame is a web-only concept, so on native this is always
 * false. See the `.web.ts` variant for the real implementation.
 */
export default function getIsInPhoneFrame(): boolean {
  return false;
}
