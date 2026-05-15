import React, {useCallback, useMemo, useState} from 'react';
import type {StyleProp, TextStyle} from 'react-native';
import {View} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ErrorUtils from '@libs/ErrorUtils';
import CONST from '@src/CONST';
import Button from './Button';
import CheckboxWithLabel from './CheckboxWithLabel';
import Text from './Text';
import TextLink from './TextLink';

type TermsScreenContentProps = {
  /** Heading text displayed above the description */
  title: string;

  /** Called when the user confirms acceptance. May be async. */
  onAccept: () => Promise<void> | void;
};

function TermsScreenContent({title, onAccept}: TermsScreenContentProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [isChecked, setIsChecked] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const linkStyles = useMemo<StyleProp<TextStyle>>(
    () => [styles.textNormal, styles.link, styles.pv3],
    [styles],
  );

  const toggleIsChecked = () => {
    const newErrorText = !isChecked ? '' : translate('agreeToTerms.mustAgree');
    setIsChecked(!isChecked);
    setErrorText(newErrorText);
  };

  const onConfirm = useCallback(() => {
    (async () => {
      if (!isChecked) {
        setErrorText(translate('agreeToTerms.mustAgree'));
        return;
      }
      try {
        setIsSubmitting(true);
        await onAccept();
      } catch (error) {
        const appError = ErrorUtils.getAppError(undefined, error);
        setErrorText(appError.message);
      } finally {
        setIsSubmitting(false);
      }
    })();
  }, [isChecked, onAccept, translate]);

  return (
    <View style={[styles.mt3, styles.mh5]}>
      <View style={styles.mb4}>
        <Text style={[styles.textHeadlineH1]}>{title}</Text>
        <Text style={[styles.mv4, styles.textNormal]}>
          {translate('agreeToTerms.description')}
        </Text>
        <TextLink style={linkStyles} href={CONST.TERMS_URL}>
          {translate('common.termsOfService')}
        </TextLink>
        <TextLink style={linkStyles} href={CONST.PRIVACY_URL}>
          {translate('common.privacyPolicy')}
        </TextLink>
      </View>
      <CheckboxWithLabel
        label={translate('agreeToTerms.iHaveRead')}
        accessibilityLabel={translate('agreeToTerms.iHaveRead')}
        errorText={errorText}
        style={errorText ? styles.mb2 : styles.mb4}
        isChecked={isChecked}
        onInputChange={toggleIsChecked}
      />
      <Button
        large
        success
        pressOnEnter
        isLoading={isSubmitting}
        isDisabled={isSubmitting}
        onPress={onConfirm}
        text={translate('common.confirm')}
      />
    </View>
  );
}

TermsScreenContent.displayName = 'TermsScreenContent';

export default TermsScreenContent;
export type {TermsScreenContentProps};
