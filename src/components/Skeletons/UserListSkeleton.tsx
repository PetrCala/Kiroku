import React from 'react';
import {Circle, Rect} from 'react-native-svg';
import variables from '@styles/variables';
import ItemListSkeletonView from './ItemListSkeletonView';

// Mirror the UserOverview row: a large avatar with the display name to its
// right and the session status pinned to the far right. Keeping the geometry
// aligned with the real row avoids a layout jump when the list swaps in.
const avatarRadius = variables.avatarSizeLarge / 2;
const horizontalPadding = 12; // userOverviewContainer ph3
const verticalPadding = 8; // userOverviewContainer p2
const itemHeight = variables.avatarSizeLarge + verticalPadding * 2;

const barHeight = 10;
const avatarCx = horizontalPadding + avatarRadius;
const avatarCy = itemHeight / 2;
const barY = avatarCy - barHeight / 2;
const nameX = avatarCx + avatarRadius + 12; // ml3 gap after the avatar

type UserListSkeletonProps = {
  shouldAnimate?: boolean;
  fixedNumItems?: number;
  gradientOpacityEnabled?: boolean;
};

function UserListSkeleton({
  shouldAnimate = true,
  fixedNumItems,
  gradientOpacityEnabled = false,
}: UserListSkeletonProps) {
  return (
    <ItemListSkeletonView
      shouldAnimate={shouldAnimate}
      fixedNumItems={fixedNumItems}
      gradientOpacityEnabled={gradientOpacityEnabled}
      itemViewHeight={itemHeight}
      renderSkeletonItem={() => (
        <>
          <Circle cx={avatarCx} cy={avatarCy} r={avatarRadius} />
          {/* display name */}
          <Rect x={nameX} y={barY} width="40%" height={barHeight} />
          {/* session status, pinned to the right */}
          <Rect x="72%" y={barY} width="20%" height={barHeight} />
        </>
      )}
    />
  );
}

UserListSkeleton.displayName = 'UserListSkeleton';

export default UserListSkeleton;
