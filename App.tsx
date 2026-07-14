import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Image, StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { QuickAddProvider } from './src/context/QuickAddContext';
import { AppNavigation } from './src/navigation';
import { QuickAddHost } from './src/screens/quickadd/QuickAddHost';
import { ToastProvider } from './src/theme/components';
import { colors } from './src/theme/tokens';

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Show splash for 4.5s, then fade out over 500ms (total 5s)
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 4500);

    return () => clearTimeout(timer);
  }, [fadeAnim, onFinish]);

  return (
    <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
      <Image
        source={{ uri: 'ic_launcher' }}
        style={styles.splashLogo}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

function Root() {
  const { ready } = useApp();
  const insets = useSafeAreaInsets();

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <AppNavigation />
      <QuickAddHost />
    </View>
  );
}

function App() {
  const [splashFinished, setSplashFinished] = useState(false);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <AppProvider>
          <QuickAddProvider>
            <ToastProvider>
              <Root />
              {!splashFinished && (
                <SplashScreen onFinish={() => setSplashFinished(true)} />
              )}
            </ToastProvider>
          </QuickAddProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0B0D11',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  splashLogo: {
    width: 144,
    height: 144,
  },
});

export default App;
