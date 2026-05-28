import React from 'react';
import {useErrorBoundary} from 'react-error-boundary';
import {View} from 'react-native';
import Button from '@components/Button';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import SafeAreaConsumer from '@components/SafeAreaConsumer';
import Text from '@components/Text';
import TextLink from '@components/TextLink';
import useLocalize from '@hooks/useLocalize';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import * as Session from '@userActions/Session';
import CONST from '@src/CONST';
import {useFirebase} from '@context/global/FirebaseContext';
import ErrorBodyText from './ErrorBodyText';

function GenericErrorScreen() {
  const {auth} = useFirebase();
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {translate} = useLocalize();

  const {resetBoundary} = useErrorBoundary();

  return (
    <SafeAreaConsumer>
      {({paddingBottom}) => (
        <View
          style={[
            styles.flex1,
            styles.pt10,
            styles.ph5,
            StyleUtils.getErrorScreenContainerStyle(Number(paddingBottom)),
          ]}>
          <View
            style={[
              styles.flex1,
              styles.alignItemsCenter,
              styles.justifyContentCenter,
            ]}>
            <View>
              <View style={styles.mb5}>
                <Icon
                  src={KirokuIcons.Bug}
                  height={variables.componentSizeNormal}
                  width={variables.componentSizeNormal}
                  fill={theme.iconSuccessFill}
                />
              </View>
              <View style={styles.mb5}>
                <Text style={[styles.textHeadline]}>
                  {translate('genericErrorScreen.title')}
                </Text>
              </View>
              <View style={styles.mb5}>
                <ErrorBodyText />
                <Text>
                  {`${translate('genericErrorScreen.body.helpTextEmail')} `}
                  <TextLink
                    href={`mailto:${CONST.EMAIL.KIROKU}`}
                    style={[styles.link]}>
                    {CONST.EMAIL.KIROKU}
                  </TextLink>
                </Text>
              </View>
              <View style={[styles.flexRow]}>
                <View style={[styles.flex1, styles.flexRow]}>
                  <Button
                    success
                    medium
                    onPress={resetBoundary}
                    text={translate('genericErrorScreen.refresh')}
                    style={styles.mr3}
                  />
                  <Button
                    medium
                    onPress={() => {
                      Session.signOut(auth);
                      resetBoundary();
                    }}
                    text={translate('settingsScreen.signOut')}
                  />
                </View>
              </View>
            </View>
          </View>
          {/* <View>
            <View
              style={[
                styles.flex1,
                styles.flexRow,
                styles.justifyContentCenter,
              ]}>
              <ImageSVG
                contentFit="contain"
                src={LogoWordmark}
                height={30}
                width={80}
                fill={theme.text}
              />
            </View>
          </View> */}
        </View>
      )}
    </SafeAreaConsumer>
  );
}

GenericErrorScreen.displayName = 'ErrorScreen';

export default GenericErrorScreen;
