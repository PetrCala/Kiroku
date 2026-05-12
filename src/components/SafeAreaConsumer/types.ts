import type {DimensionValue} from 'react-native';
import type {EdgeInsets} from 'react-native-safe-area-context';

type SafeAreaChildrenProps = {
  paddingTop?: DimensionValue;
  paddingBottom?: DimensionValue;
  insets?: EdgeInsets;
  safeAreaPaddingBottomStyle: {
    paddingBottom?: DimensionValue;
  };
};

type SafeAreaConsumerProps = {
  children: (props: SafeAreaChildrenProps) => React.ReactNode;
};

export default SafeAreaConsumerProps;

export type {SafeAreaChildrenProps};
