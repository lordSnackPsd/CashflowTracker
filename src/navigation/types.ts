import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Transactions: { categoryId?: string; accountId?: string } | undefined;
  Spending: undefined;
  Business: undefined;
};

export type DrawerParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Loans: undefined;
  Categories: undefined;
  Cash: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<DrawerParamList>;
  AccountDetail: { accountId: string };
  DebtDetail: { debtId: string };
  ClientDetail: { clientId: string };
  CategoryDetail: { categoryId: string };
  TransactionDetail: { transactionId: string };
  Archive: undefined;
};
