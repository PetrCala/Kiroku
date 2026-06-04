import {useEffect, useState} from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import type {BugList, NicknameToId} from '@src/types/onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import {removeBug} from '@libs/actions/Feedback';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import DateUtils from '@libs/DateUtils';
import MenuItem from '@components/MenuItem';
import Button from '@components/Button';
import useTheme from '@hooks/useTheme';
import {listenForDataChanges} from '@database/baseFunctions';
import DBPATHS from '@src/DBPATHS';
import {fetchUserNicknames} from '@libs/actions/User';
import type {Timestamp} from '@src/types/onyx/OnyxCommon';
import CONST from '@src/CONST';

function SeeBugsScreen() {
  const {translate} = useLocalize();
  const {db} = useFirebase();
  const styles = useThemeStyles();
  const theme = useTheme();
  const [nicknames, setNicknames] = useState<NicknameToId>({});
  const [bugList, setBugList] = useState<BugList>({});

  useEffect(() => {
    const dbRef = DBPATHS.BUGS;
    const stopListening = listenForDataChanges(
      db,
      dbRef,
      (data: BugList | null) => {
        const newData = data ?? {};
        setBugList(newData);
      },
    );

    // Stop listening for changes when the component unmounts
    return () => {
      stopListening();
    };
  }, [db]);

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
  }, [bugList, db, nicknames]);

  const deleteBug = (bugKey: string) => {
    removeBug(bugKey);
  };

  const removeBugButton = (id: string) => {
    return (
      <Button
        icon={KirokuIcons.ThinX}
        iconFill={theme.textError}
        style={styles.bgTransparent}
        onPress={() => deleteBug(id)}
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

  return (
    <ScreenWrapper testID={SeeBugsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('adminScreen.bugReports')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.w100]}>
        <Section
          title=""
          containerStyles={styles.ph0}
          childrenStyles={styles.pt3}>
          {Object.entries(bugList).map(([id, bug]) => (
            <MenuItem
              // eslint-disable-next-line react/no-array-index-key
              key={`${id}`}
              title={getVerboseBugsHeading(bug.user_id, bug.submit_time)}
              description={bug.text}
              numberOfLinesDescription={20}
              style={styles.borderTopRounded}
              rightComponent={removeBugButton(id)}
              shouldShowRightComponent
              disabled
            />
          ))}
        </Section>
      </ScrollView>
    </ScreenWrapper>
  );
}

SeeBugsScreen.displayName = 'SeeBugsScreen';
export default SeeBugsScreen;
