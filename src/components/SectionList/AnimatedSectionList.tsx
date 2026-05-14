import {SectionList as RNSectionList} from 'react-native';
import Animated from 'react-native-reanimated';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnimatedSectionList = Animated.createAnimatedComponent(
  RNSectionList,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as unknown as ReturnType<typeof Animated.createAnimatedComponent<any>>;

export default AnimatedSectionList;
