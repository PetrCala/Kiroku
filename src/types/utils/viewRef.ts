import type {View} from 'react-native';

const viewRef = (ref: React.RefObject<View | HTMLDivElement | null>) =>
  ref as React.RefObject<View>;

export default viewRef;
