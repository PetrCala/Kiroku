import type {StackCardInterpolationProps} from '@react-navigation/stack';

/**
 * Card-style interpolator for the fullscreen sessions-calendar route.
 *
 * Instead of the default horizontal slide, the route fades and grows from
 * 92% scale to 100% — giving the impression that the compact calendar is
 * lifting up off the page and expanding to fill the viewport. The screen
 * below stays put so the surrounding UI looks like it's being pushed aside.
 */
function sessionsCalendarCardStyleInterpolator({
  current,
}: StackCardInterpolationProps) {
  const progress = current.progress;
  return {
    cardStyle: {
      opacity: progress,
      transform: [
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1],
          }),
        },
      ],
    },
  };
}

export default sessionsCalendarCardStyleInterpolator;
