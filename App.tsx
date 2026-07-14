import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { QuickAddProvider } from './src/context/QuickAddContext';
import { AppNavigation } from './src/navigation';
import { QuickAddHost } from './src/screens/quickadd/QuickAddHost';
import { ToastProvider } from './src/theme/components';
import { colors } from './src/theme/tokens';

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
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <AppProvider>
          <QuickAddProvider>
            <ToastProvider>
              <Root />
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
});

export default App;
