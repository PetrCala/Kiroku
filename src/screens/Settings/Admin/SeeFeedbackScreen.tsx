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
import type {Feedback, NicknameToId} from '@src/types/onyx';
import {getFeedbackList, removeFeedback} from '@libs/actions/Feedback';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import DateUtils from '@libs/DateUtils';
import MenuItem from '@components/MenuItem';
import Button from '@components/Button';
import useTheme from '@hooks/useTheme';
import {fetchUserNicknames} from '@libs/actions/User';
import type {Timestamp} from '@src/types/onyx/OnyxCommon';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

function SeeFeedbackScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const theme = useTheme();
  // Render from Onyx so a slow response still lands after the screen unmounts
  // and a re-visit shows the cached list instantly. The fetch below refreshes it.
  const [feedbackList] = useOnyx(ONYXKEYS.FEEDBACK_LIST);
  const [nicknames, setNicknames] = useState<NicknameToId>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getFeedbackList().finally(() => {
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
      if (!feedbackList) {
        setNicknames({});
        return;
      }

      let newNicknames: NicknameToId = {};

      try {
        const userIds = Object.values(feedbackList).map(
          feedback => feedback.user_id,
        );
        newNicknames = (await fetchUserNicknames(userIds)) ?? {};
      } catch (error) {
        console.error('Error fetching user nicknames:', error);
      }

      setNicknames(newNicknames);
    };

    fetchNicknames();
  }, [feedbackList]);

  const deleteFeedback = (feedbackKey: string, feedback: Feedback) => {
    removeFeedback(feedbackKey, feedback);
  };

  const removeFeedbackButton = (id: string, feedback: Feedback) => {
    return (
      <Button
        icon={KirokuIcons.ThinX}
        iconFill={theme.textError}
        style={styles.bgTransparent}
        onPress={() => deleteFeedback(id, feedback)}
      />
    );
  };

  const getVerboseFeedbackHeading = (
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

  const feedbackEntries = Object.entries(feedbackList ?? {});

  return (
    <ScreenWrapper testID={SeeFeedbackScreen.displayName}>
      <HeaderWithBackButton
        title={translate('adminScreen.feedback')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      {isLoading && feedbackEntries.length === 0 ? (
        <FullScreenLoadingIndicator />
      ) : (
        <ScrollView contentContainerStyle={[styles.w100]}>
          <Section
            title=""
            containerStyles={styles.ph0}
            childrenStyles={styles.pt3}>
            {feedbackEntries.map(([id, feedback]) => (
              <MenuItem
                key={`${id}`}
                title={getVerboseFeedbackHeading(
                  feedback.user_id,
                  feedback.submit_time,
                )}
                description={feedback.text}
                numberOfLinesDescription={20}
                style={styles.borderTopRounded}
                rightComponent={removeFeedbackButton(id, feedback)}
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

SeeFeedbackScreen.displayName = 'SeeFeedbackScreen';
export default SeeFeedbackScreen;
