import { features, type FeatureFlags } from '../config/features';

export type FeatureName = keyof FeatureFlags;

export type FeatureHandler<T> = () => T | Promise<T>;

export interface FeatureHandlers<T> {
  enabled: FeatureHandler<T>;
  disabled?: FeatureHandler<T>;
}

export const withFeature = (flagName: FeatureName) =>
  async <T>(handlers: FeatureHandlers<T>): Promise<T | undefined> => {
    const flagEnabled = features[flagName];

    if (!flagEnabled) {
      return handlers.disabled ? handlers.disabled() : undefined;
    }

    return handlers.enabled();
  };

export default withFeature;
