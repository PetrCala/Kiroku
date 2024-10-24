import React from 'react';
import {View} from 'react-native';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

type ListItemRightCaretWithLabelProps = {
  labelText?: string;
  shouldShowCaret?: boolean;
};

function ListItemRightCaretWithLabel({
  labelText,
  shouldShowCaret = true,
}: ListItemRightCaretWithLabelProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

  return (
    <View style={styles.flexRow}>
      {!!labelText && (
        <Text
          style={[
            styles.alignSelfCenter,
            styles.textSupporting,
            styles.pl2,
            styles.label,
          ]}>
          {labelText}
        </Text>
      )}
      {shouldShowCaret && (
        <View style={[styles.pl2]}>
          <Icon src={KirokuIcons.ArrowRight} fill={theme.icon} />
        </View>
      )}
    </View>
  );
}

ListItemRightCaretWithLabel.displayName = 'ListItemRightCaretWithLabel';

export default ListItemRightCaretWithLabel;
