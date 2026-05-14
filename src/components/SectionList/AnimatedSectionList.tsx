import {SectionList as RNSectionList} from 'react-native';
import Animated from 'react-native-reanimated';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnimatedSectionList = Animated.createAnimatedComponent(
  RNSectionList,
) as ReturnType<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeof Animated.createAnimatedComponent<any>
>;

export default AnimatedSectionList;
