// import React from 'react';
// import {View} from 'react-native';
// import Avatar from '@components/Avatar';
// import Text from '@components/Text';
// import useThemeStyles from '@hooks/useThemeStyles';
// import useWindowDimensions from '@hooks/useWindowDimensions';
// import CONST from '@src/CONST';
// import type {SearchUserData} from '@src/types/onyx/SearchResults';

// type UserInfoCellProps = {
//   participant: SearchUserData;
//   displayName: string;
// };

// function UserInfoCell({participant, displayName}: UserInfoCellProps) {
//   const styles = useThemeStyles();
//   const {isLargeScreenWidth} = useWindowDimensions();
//   const avatarURL = participant?.avatar;

//   return (
//     <View style={[styles.flexRow, styles.alignItemsCenter]}>
//       <Avatar
//         imageStyles={[styles.alignSelfCenter]}
//         size={CONST.AVATAR_SIZE.MID_SUBSCRIPT}
//         source={avatarURL}
//         name={displayName}
//         type={CONST.ICON_TYPE_AVATAR}
//         avatarID={participant?.accountID}
//         containerStyles={[styles.pr2]}
//       />
//       <Text
//         numberOfLines={1}
//         style={[
//           isLargeScreenWidth
//             ? styles.themeTextColor
//             : [styles.textMicro, styles.textBold],
//           styles.flexShrink1,
//         ]}>
//         {displayName}
//       </Text>
//     </View>
//   );
// }

// UserInfoCell.displayName = 'UserInfoCell';

// export default UserInfoCell;
