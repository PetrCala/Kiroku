import type {StackScreenProps} from '@react-navigation/stack';
import React from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import MenuItem from '@components/MenuItem';
import MenuItemGroup from '@components/MenuItemGroup';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import type {SettingsNavigatorParamList} from '@navigation/types';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';

type ManageAccountScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.MANAGE_ACCOUNT
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ManageAccountScreen({route}: ManageAccountScreenProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();

  return (
    <ScreenWrapper
      testID={ManageAccountScreen.displayName}
      includeSafeAreaPaddingBottom={false}
      shouldShowOfflineIndicatorInWideScreen>
      <HeaderWithBackButton
        title={translate('manageAccountScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <ScrollView style={styles.pt3}>
        <MenuItemGroup>
          <Section
            title={translate('manageAccountScreen.dangerZone.title')}
            subtitle={translate('manageAccountScreen.dangerZone.subtitle')}
            isCentralPane
            subtitleMuted
            childrenStyles={styles.pt3}
            titleStyles={styles.generalSectionTitle}>
            <MenuItem
              title={translate('manageAccountScreen.deleteAccount.title')}
              icon={KirokuIcons.Delete}
              iconType={CONST.ICON_TYPE_ICON}
              iconFill={theme.danger}
              titleStyle={styles.textDanger}
              wrapperStyle={styles.sectionMenuItemTopDescription}
              shouldShowRightIcon
              onPress={() => Navigation.navigate(ROUTES.SETTINGS_DELETE)}
            />
          </Section>
        </MenuItemGroup>
      </ScrollView>
    </ScreenWrapper>
  );
}

ManageAccountScreen.displayName = 'Manage Account Screen';
export default ManageAccountScreen;
