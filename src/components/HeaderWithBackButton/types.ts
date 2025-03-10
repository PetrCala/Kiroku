import type {ReactNode} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import type {PopoverMenuItem} from '@components/PopoverMenu';
import type {Action} from '@hooks/useSingleExecution';
import type {AnchorPosition} from '@src/styles';
import type {Icon} from '@src/types/onyx/OnyxCommon';
import type ChildrenProps from '@src/types/utils/ChildrenProps';
import type IconAsset from '@src/types/utils/IconAsset';

type ThreeDotsMenuItem = {
  /** An icon element displayed on the left side */
  icon: IconAsset;

  /** Text label */
  text: string;

  /** A callback triggered when the item is selected */
  onSelected: () => void;
};

type HeaderWithBackButtonProps = Partial<ChildrenProps> & {
  /** Title of the Header */
  title?: string;

  /** Subtitle of the header */
  subtitle?: ReactNode;

  /** Title color */
  titleColor?: string;

  /**
   * Icon displayed on the left of the title.
   * If it is passed, the new styling is applied to the component:
   * taller header on desktop and different font of the title.
   * */
  icon?: IconAsset;

  /** Method to trigger when pressing download button of the header */
  onDownloadButtonPress?: () => void;

  /** Method to trigger when pressing close button of the header */
  onCloseButtonPress?: () => void;

  /** Method to trigger when pressing back button of the header */
  onBackButtonPress?: () => void;

  /** Method to trigger when pressing more options button of the header */
  onThreeDotsButtonPress?: () => void;

  /** Whether we should show a border on the bottom of the Header */
  shouldShowBorderBottom?: boolean;

  /** Whether we should show a download button */
  shouldShowDownloadButton?: boolean;

  /** Whether we should show a get assistance (question mark) button */
  shouldShowGetAssistanceButton?: boolean;

  /** Whether we should disable the get assistance button */
  shouldDisableGetAssistanceButton?: boolean;

  /** Whether we should show a pin button */
  shouldShowPinButton?: boolean;

  /** Whether we should show a more options (threedots) button */
  shouldShowThreeDotsButton?: boolean;

  /** Whether we should disable threedots button */
  shouldDisableThreeDotsButton?: boolean;

  /** Whether we should set modal visibility when three dot menu opens */
  shouldSetModalVisibility?: boolean;

  /** List of menu items for more(three dots) menu */
  threeDotsMenuItems?: PopoverMenuItem[];

  /** The anchor position of the menu */
  threeDotsAnchorPosition?: AnchorPosition;

  /** Whether we should show a close button */
  shouldShowCloseButton?: boolean;

  /** Whether we should show a back button */
  shouldShowBackButton?: boolean;

  /** Single execution function to prevent concurrent navigation actions */
  singleExecution?: <T extends unknown[]>(action: Action<T>) => Action<T>;

  /** Whether we should navigate to report page when the route have a topMostReport  */
  shouldNavigateToTopMostReport?: boolean;

  /** The fill color for the icon. Can be hex, rgb, rgba, or valid react-native named color such as 'red' or 'blue'. */
  iconFill?: string;

  /** Whether the popover menu should overlay the current view */
  shouldOverlay?: boolean;

  /** Whether we should enable detail page navigation */
  shouldEnableDetailPageNavigation?: boolean;

  /** A custom React component to render on the right hand side */
  customRightButton?: ReactNode;

  /** Whether we should overlay the 3 dots menu */
  shouldOverlayDots?: boolean;

  /** 0 - 100 number indicating current progress of the progress bar */
  progressBarPercentage?: number;

  /** Avatar to display in the header */
  avatar?: Icon;

  /** Additional styles to add to the component */
  style?: StyleProp<ViewStyle>;
};

export type {ThreeDotsMenuItem};
export default HeaderWithBackButtonProps;
