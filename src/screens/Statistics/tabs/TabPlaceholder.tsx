import React from 'react';
import {StyleSheet, View} from 'react-native';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import type {TranslationPaths} from '@src/languages/types';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
});

type TabPlaceholderProps = {
  copyKey: TranslationPaths;
};

function TabPlaceholder({copyKey}: TabPlaceholderProps) {
  const {translate} = useLocalize();
  const themeStyles = useThemeStyles();

  return (
    <View style={styles.container}>
      <Text style={[themeStyles.textNormal, themeStyles.textAlignCenter]}>
        {translate(copyKey)}
      </Text>
    </View>
  );
}

TabPlaceholder.displayName = 'TabPlaceholder';

export default TabPlaceholder;
