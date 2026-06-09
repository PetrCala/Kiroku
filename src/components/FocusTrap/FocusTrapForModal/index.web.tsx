import FocusTrap from 'focus-trap-react';
import React from 'react';
import sharedTrapStack from '@components/FocusTrap/sharedTrapStack';
import type FocusTrapForModalProps from './FocusTrapForModalProps';

function FocusTrapForModal({
  children,
  active,
  initialFocus = false,
}: FocusTrapForModalProps) {
  return (
    <FocusTrap
      active={active}
      focusTrapOptions={{
        trapStack: sharedTrapStack,
        clickOutsideDeactivates: true,
        initialFocus,
        // Fall back to the document body so the trap never throws when the
        // modal momentarily has no tabbable node (e.g. during enter/exit).
        fallbackFocus: document.body,
      }}>
      {children}
    </FocusTrap>
  );
}

FocusTrapForModal.displayName = 'FocusTrapForModal';

export default FocusTrapForModal;
