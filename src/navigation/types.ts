export type RootStackParamList = {
  Home: undefined;
  Search: undefined;
  Stop: { stopIdx: number };
  Line: { routeIdx: number; stopIdx?: number };
  SelectedLine: { tripIdx: number; stopIdx: number };
};
