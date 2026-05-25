import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {View} from 'react-native';

type StatTone = 'neutral' | 'celebratory';

type StatItemProps = {
  header: string;
  content: string;
  tone?: StatTone;
};

function StatItem({header, content, tone = 'neutral'}: StatItemProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const accent = tone === 'celebratory' ? {color: theme.success} : null;

  return (
    <View
      style={[
        styles.flexColumn,
        styles.alignItemsCenter,
        styles.justifyContentCenter,
      ]}>
      <Text style={[styles.statItemText, accent]}>{content}</Text>
      <Text
        style={styles.statItemLabelText}
        numberOfLines={2}
        ellipsizeMode="tail">
        {header}
      </Text>
    </View>
  );
}

export default StatItem;
export type {StatTone};
