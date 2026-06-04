import type { Location, NavigateFunction, To } from "react-router-dom";

type UnknownState = Record<string, unknown>;

export type NavigationOriginState = {
  pathname: string;
  search: string;
  state: UnknownState | null;
  fallbackPath: string;
};

export type NavigationLocationState<TRestore = unknown> = UnknownState & {
  origin?: NavigationOriginState;
  restore?: TRestore;
};

function isPlainObject(value: unknown): value is UnknownState {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getNavigationLocationState<TRestore = unknown>(
  state: unknown
): NavigationLocationState<TRestore> {
  if (!isPlainObject(state)) {
    return {};
  }

  return state as NavigationLocationState<TRestore>;
}

export function mergeNavigationState(
  currentState: unknown,
  patch: Record<string, unknown>
): UnknownState | null {
  const nextState = {
    ...getNavigationLocationState(currentState),
    ...patch,
  };

  return Object.keys(nextState).length > 0 ? nextState : null;
}

export function omitNavigationStateKeys(currentState: unknown, keys: string[]): UnknownState | null {
  const nextState = { ...getNavigationLocationState(currentState) };

  for (const key of keys) {
    delete nextState[key];
  }

  return Object.keys(nextState).length > 0 ? nextState : null;
}

export function buildNavigationOrigin(
  location: Pick<Location, "pathname" | "search" | "state">,
  fallbackPath: string
): NavigationOriginState {
  return {
    pathname: location.pathname,
    search: location.search,
    state: getNavigationLocationState(location.state),
    fallbackPath,
  };
}

export function withNavigationOrigin(
  location: Pick<Location, "pathname" | "search" | "state">,
  fallbackPath: string,
  nextState?: unknown
): UnknownState {
  return {
    ...getNavigationLocationState(nextState),
    origin: buildNavigationOrigin(location, fallbackPath),
  };
}

export function navigateWithOrigin(
  navigate: NavigateFunction,
  location: Pick<Location, "pathname" | "search" | "state">,
  to: To,
  fallbackPath: string,
  nextState?: unknown
) {
  navigate(to, {
    state: withNavigationOrigin(location, fallbackPath, nextState),
  });
}

export function navigateBackWithOrigin(
  navigate: NavigateFunction,
  state: unknown,
  fallbackPath: string
) {
  const navigationState = getNavigationLocationState(state);
  const origin = navigationState.origin;

  if (!origin) {
    navigate(fallbackPath);
    return;
  }

  navigate(`${origin.pathname}${origin.search}`, {
    state: origin.state,
  });
}
