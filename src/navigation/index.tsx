import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import {
  Briefcase,
  HandCoins,
  Home as HomeIcon,
  LayoutGrid,
  List,
  Plus,
  Settings as SettingsIcon,
  TrendingDown,
  Wallet,
  X,
} from 'lucide-react-native';
import { colors, colorsExtra, typeScale } from '../theme/tokens';
import { NavBtn } from '../theme/components';
import { useQuickAdd } from '../context/QuickAddContext';
import type { DrawerParamList, RootStackParamList, TabParamList } from './types';

import { HomeScreen } from '../screens/home/HomeScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { TransactionDetailScreen } from '../screens/transactions/TransactionDetailScreen';
import { SpendingScreen } from '../screens/spending/SpendingScreen';
import { BusinessScreen } from '../screens/business/BusinessScreen';
import { ClientDetailScreen } from '../screens/business/ClientDetailScreen';
import { LoansScreen } from '../screens/debts/LoansScreen';
import { DebtDetailScreen } from '../screens/debts/DebtDetailScreen';
import { CategoriesScreen } from '../screens/categories/CategoriesScreen';
import { CategoryDetailScreen } from '../screens/categories/CategoryDetailScreen';
import { CashManagementScreen } from '../screens/cash/CashManagementScreen';
import { AccountDetailScreen } from '../screens/cash/AccountDetailScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ArchiveScreen } from '../screens/settings/ArchiveScreen';
import { ExpectedPaymentsScreen } from '../screens/business/ExpectedPaymentsScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabBar({ state, navigation }: BottomTabBarProps) {
  const quickAdd = useQuickAdd();
  const routes = state.routes;
  const isActive = (name: string) =>
    routes[state.index]?.name === name;

  return (
    <View style={styles.tabBar}>
      <NavBtn
        active={isActive('Home')}
        icon={HomeIcon}
        label="Home"
        onPress={() => navigation.navigate('Home')}
      />
      <NavBtn
        active={isActive('Transactions')}
        icon={List}
        label="History"
        onPress={() => navigation.navigate('Transactions')}
      />
      <Pressable
        onPress={() => quickAdd.open()}
        style={styles.fab}
        accessibilityLabel="Quick add"
      >
        <Plus size={22} color={colors.bg} />
      </Pressable>
      <NavBtn
        active={isActive('Spending')}
        icon={TrendingDown}
        label="Spending"
        onPress={() => navigation.navigate('Spending')}
      />
      <NavBtn
        active={isActive('Business')}
        icon={Briefcase}
        label="Business"
        onPress={() => navigation.navigate('Business')}
      />
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={props => <TabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Spending" component={SpendingScreen} />
      <Tab.Screen name="Business" component={BusinessScreen} />
    </Tab.Navigator>
  );
}

const MENU_ITEMS: Array<{
  key: keyof DrawerParamList;
  icon: typeof Wallet;
  label: string;
}> = [
  { key: 'Cash', icon: Wallet, label: 'Cash management' },
  { key: 'Loans', icon: HandCoins, label: 'Loans and debts' },
  { key: 'Categories', icon: LayoutGrid, label: 'Categories & items' },
  { key: 'Settings', icon: SettingsIcon, label: 'Settings' },
];

function MenuContent({ navigation }: DrawerContentComponentProps) {
  return (
    <DrawerContentScrollView style={styles.menu}>
      <View style={styles.menuHeader}>
        <Text style={styles.menuTitle}>Menu</Text>
        <Pressable onPress={() => navigation.closeDrawer()} hitSlop={12}>
          <X size={18} color={colors.dim} />
        </Pressable>
      </View>
      {MENU_ITEMS.map(m => (
        <Pressable
          key={m.key}
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => navigation.navigate(m.key)}
        >
          <m.icon size={16} color={colors.dim} />
          <Text style={styles.menuLabel}>{m.label}</Text>
        </Pressable>
      ))}
    </DrawerContentScrollView>
  );
}

function Main() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: colorsExtra.navBg, width: 280 },
        drawerType: 'front',
        swipeEdgeWidth: 60,
      }}
      drawerContent={props => <MenuContent {...props} />}
    >
      <Drawer.Screen name="Tabs" component={Tabs} />
      <Drawer.Screen name="Loans" component={LoansScreen} />
      <Drawer.Screen name="Categories" component={CategoriesScreen} />
      <Drawer.Screen name="Cash" component={CashManagementScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colorsExtra.navBg,
    text: colors.text,
    border: colorsExtra.navBorder,
    primary: colors.gold,
  },
};

export function AppNavigation() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={Main} />
        <Stack.Screen name="AccountDetail" component={AccountDetailScreen} />
        <Stack.Screen name="DebtDetail" component={DebtDetailScreen} />
        <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
        <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
        <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
        <Stack.Screen name="Archive" component={ArchiveScreen} />
        <Stack.Screen name="ExpectedPayments" component={ExpectedPaymentsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 64,
    backgroundColor: colorsExtra.navBg,
    borderTopWidth: 1,
    borderTopColor: colorsExtra.navBorder,
    paddingHorizontal: 8,
  },
  fab: {
    width: 48,
    height: 48,
    marginTop: -24,
    borderRadius: 24,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  menu: {
    flex: 1,
    paddingHorizontal: 16,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  menuTitle: {
    fontSize: typeScale.xl,
    fontWeight: '500',
    color: colors.text,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
  },
  menuItemPressed: {
    backgroundColor: colors.surface2,
  },
  menuLabel: {
    fontSize: typeScale.lg,
    color: colors.text,
  },
});
