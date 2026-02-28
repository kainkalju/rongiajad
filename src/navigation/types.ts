export type RootStackParamList = {
  Home: undefined;
  Search: undefined;
  Stop: { stopIdx: number };
  Line: { routeIdx: number; stopIdx?: number };
  CurrentLine: { tripIdx: number; stopIdx: number };
};
