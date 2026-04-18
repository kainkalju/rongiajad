export type RootStackParamList = {
  Home: undefined;
  Search: undefined;
  Stop: { stopIdx: number; directionId?: number; region?: string | null };
  Line: { routeIdx: number; stopIdx?: number };
  SelectedLine: { tripIdx: number; stopIdx: number };
  About: undefined;
};
