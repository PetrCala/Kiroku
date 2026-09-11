import type {StyleProp, TextStyle} from 'react-native';
import useCurrentTime from '@hooks/useCurrentTime';
import formatElapsedTime from '@libs/formatElapsedTime';
import Text from './Text';

type ElapsedTimeProps = {
  /** When the timer started counting, in milliseconds since the epoch. */
  startTime: number;

  /** Additional text styles. */
  style?: StyleProp<TextStyle>;

  /** Test ID for the rendered text. */
  testID?: string;
};

// Fixed-width digits, so the text doesn't jitter as the seconds change.
const tabularNumbersStyle: TextStyle = {fontVariant: ['tabular-nums']};

/**
 * A running `h:mm:ss` timer since `startTime`. It subscribes to the shared
 * clock itself, so each tick re-renders only this text, never its parent.
 */
function ElapsedTime({startTime, style, testID}: ElapsedTimeProps) {
  const now = useCurrentTime();

  return (
    <Text style={[tabularNumbersStyle, style]} testID={testID}>
      {formatElapsedTime(now - startTime)}
    </Text>
  );
}

ElapsedTime.displayName = 'ElapsedTime';

export default ElapsedTime;
export type {ElapsedTimeProps};
