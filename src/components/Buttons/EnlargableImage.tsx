import React, {useState, useRef} from 'react';
import type {
  ImageSourcePropType,
  LayoutChangeEvent,
  StyleProp,
  ImageStyle,
} from 'react-native';
import {Animated} from 'react-native';
import FullScreenModal from '@components/Modals/FullScreenModal';
import type ImageLayout from '@src/types/various/ImageLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {PressableWithFeedback} from '@components/Pressable';
import useLocalize from '@hooks/useLocalize';
import useWindowDimensions from '@hooks/useWindowDimensions';

type EnlargableImageProps = {
  imageSource: ImageSourcePropType;
  imageStyle: StyleProp<ImageStyle>;
  /** The thumbnail trigger that opens the fullscreen view when pressed. */
  children: React.ReactNode;
};

function EnlargableImage({
  imageSource,
  imageStyle,
  children,
}: EnlargableImageProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [modalVisible, setModalVisible] = useState(false);
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const positionAnimation = useRef(new Animated.ValueXY({x: 0, y: 0})).current;
  const {windowHeight, windowWidth} = useWindowDimensions();

  const [layout, setLayout] = useState<ImageLayout>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const currentLayout = event.nativeEvent.layout;
    setLayout({
      x: currentLayout.x,
      y: currentLayout.y,
      width: currentLayout.width,
      height: currentLayout.height,
    });
  };

  const handleOnLayout = (event: LayoutChangeEvent) => {
    onLayout(event);
    positionAnimation.setValue({
      x: event.nativeEvent.layout.x,
      y: event.nativeEvent.layout.y,
    });
    scaleAnimation.setValue(1);
  };

  const handlePress = () => {
    const coverScale = Math.min(
      windowWidth / layout.width,
      windowHeight / layout.height,
    );

    // If you want it truly centered, compute the offset so that
    // the enlarged image is horizontally and vertically centered.
    // Because we are scaling the image around its top-left corner,
    // we have to shift it to center.
    const enlargedWidth = layout.width * coverScale;
    // const enlargedHeight = layout.height * coverScale;

    const offsetX = (windowWidth - enlargedWidth) / 2;
    // const offsetY = (windowHeight - enlargedHeight) / 2;
    const offsetY = 0; // For some reason, this makes the image centered

    setModalVisible(true);

    Animated.parallel([
      Animated.timing(scaleAnimation, {
        toValue: coverScale,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(positionAnimation, {
        toValue: {x: offsetX, y: offsetY},
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      // Reverse the animation
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(positionAnimation, {
        toValue: {x: layout.x, y: layout.y},
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
    });
  };

  return (
    <>
      <PressableWithFeedback
        accessibilityLabel={translate('profileScreen.profileImage')}
        onPress={handlePress}
        onLayout={handleOnLayout}>
        {children}
      </PressableWithFeedback>
      <FullScreenModal
        visible={modalVisible}
        onClose={closeModal}
        style={styles.bgDark}>
        <Animated.Image
          source={imageSource}
          style={[
            imageStyle,
            {
              // The "base" width/height from the original layout
              width: layout.width,
              height: layout.height,
              transform: [
                {translateX: positionAnimation.x},
                {translateY: positionAnimation.y},
                {scale: scaleAnimation},
              ],
              resizeMode: 'cover',
            },
          ]}
        />
      </FullScreenModal>
    </>
  );
}

export default EnlargableImage;
export type {EnlargableImageProps};
