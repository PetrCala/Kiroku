import {useNavigation} from '@react-navigation/native';
import type {NavigationAction} from '@react-navigation/native';
import React, {useEffect, useState} from 'react';
import ConfirmModal from '@components/ConfirmModal';
import useLocalize from './useLocalize';

type UseDiscardChangesGuardOptions = {
  title?: string;
  prompt?: string;
};

/**
 * Registers a `beforeRemove` listener that intercepts any navigation away
 * from the current screen — header back, hardware back, and swipe-back —
 * and shows a confirmation modal when the form has unsaved changes.
 *
 * The save handler should update its baseline (e.g. `initialValues.current = currentValues`)
 * before calling `Navigation.goBack()` so the post-save dispatch passes through cleanly.
 */
function useDiscardChangesGuard(
  isDirty: () => boolean,
  options: UseDiscardChangesGuardOptions = {},
): React.ReactElement {
  const navigation = useNavigation();
  const {translate} = useLocalize();
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(
    null,
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (!isDirty()) {
        return;
      }
      e.preventDefault();
      setPendingAction(e.data.action);
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  return (
    <ConfirmModal
      isVisible={pendingAction !== null}
      title={options.title ?? translate('common.areYouSure')}
      prompt={options.prompt ?? translate('preferencesScreen.unsavedChanges')}
      onConfirm={() => {
        const action = pendingAction;
        setPendingAction(null);
        if (action) {
          navigation.dispatch(action);
        }
      }}
      onCancel={() => setPendingAction(null)}
    />
  );
}

export default useDiscardChangesGuard;
