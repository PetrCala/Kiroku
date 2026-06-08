import {useEffect, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import type {Bug, NicknameToId} from '@src/types/onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import {getBugList, removeBug} from '@libs/actions/Feedback';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import DateUtils from '@libs/DateUtils';
import MenuItem from '@components/MenuItem';
import Button from '@components/Button';
import useTheme from '@hooks/useTheme';
import {fetchUserNicknames} from '@libs/actions/User';
import type {Timestamp} from '@src/types/onyx/OnyxCommon';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

function SeeBugsScreen() {
  const {translate} = useLocalize();
  const {db} = useFirebase();
  const styles = useThemeStyles();
  const theme = useTheme();
  // Render from Onyx so a slow response still lands after the screen unmounts
  // and a re-visit shows the cached list instantly. The fetch below refreshes it.
  const [bugList] = useOnyx(ONYXKEYS.BUG_LIST);
  const [nicknames, setNicknames] = useState<NicknameToId>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getBugList().finally(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const fetchNicknames = async () => {
      if (!bugList) {
        setNicknames({});
        return;
      }

      let newNicknames: NicknameToId = {};

      try {
        const userIds = Object.values(bugList).map(bug => bug.user_id);
        newNicknames = (await fetchUserNicknames(db, userIds)) ?? {};
      } catch (error) {
        console.error('Error fetching user nicknames:', error);
      }

      setNicknames(newNicknames);
    };

    fetchNicknames();
  }, [bugList, db]);

  const deleteBug = (bugKey: string, bug: Bug) => {
    removeBug(bugKey, bug);
  };

  const removeBugButton = (id: string, bug: Bug) => {
    return (
      <Button
        icon={KirokuIcons.ThinX}
        iconFill={theme.textError}
        style={styles.bgTransparent}
        onPress={() => deleteBug(id, bug)}
      />
    );
  };

  const getVerboseBugsHeading = (
    userId: string,
    timeSubmitted: Timestamp,
  ): string => {
    const localizedTime = DateUtils.getLocalizedTime(
      timeSubmitted,
      undefined,
      CONST.DATE.FNS_FORMAT_STRING,
    );
    return `${localizedTime} - ${nicknames[userId]}`;
  };

  const bugEntries = Object.entries(bugList ?? {});

  return (
    <ScreenWrapper testID={SeeBugsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('adminScreen.bugReports')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      {isLoading && bugEntries.length === 0 ? (
        <FullScreenLoadingIndicator />
      ) : (
        <ScrollView contentContainerStyle={[styles.w100]}>
          <Section
            title=""
            containerStyles={styles.ph0}
            childrenStyles={styles.pt3}>
            {bugEntries.map(([id, bug]) => (
              <MenuItem
                key={`${id}`}
                title={getVerboseBugsHeading(bug.user_id, bug.submit_time)}
                description={bug.text}
                numberOfLinesDescription={20}
                style={styles.borderTopRounded}
                rightComponent={removeBugButton(id, bug)}
                shouldShowRightComponent
                disabled
              />
            ))}
          </Section>
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

SeeBugsScreen.displayName = 'SeeBugsScreen';
export default SeeBugsScreen;
