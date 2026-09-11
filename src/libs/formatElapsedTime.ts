const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Format a duration as a running clock: `m:ss` under an hour, `h:mm:ss` from
 * then on. Hours keep counting past 24 (`25:00:00`), since a session that long
 * is still one session. Negative or non-finite input (a start time slightly in
 * the future because of clock skew) reads as `0:00`.
 */
function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Number.isFinite(elapsedMs)
    ? Math.max(0, Math.floor(elapsedMs / MS_PER_SECOND))
    : 0;
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
  );
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  if (hours === 0) {
    return `${minutes}:${padTwoDigits(seconds)}`;
  }
  return `${hours}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
}

export default formatElapsedTime;
