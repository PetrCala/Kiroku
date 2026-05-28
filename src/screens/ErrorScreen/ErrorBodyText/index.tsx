import React from 'react';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';

function ErrorBodyText() {
  const {translate} = useLocalize();

  return <Text>{`${translate('genericErrorScreen.body.helpTextMobile')}`}</Text>;
}

ErrorBodyText.displayName = 'ErrorBodyText';

export default ErrorBodyText;
