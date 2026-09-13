/** Runtime settings mirrored from the privacy-filter-webgpu reference app. */
export const PRIVACY_FILTER_MODEL_ID = 'openai/privacy-filter';
export const PRIVACY_FILTER_MIN_CONFIDENCE = 0.9;
export const PRIVACY_FILTER_DTYPE = 'q4';

export type PrivacyFilterDevice = 'webgpu' | 'wasm';

export function getPrivacyFilterPipelineOptions(device: PrivacyFilterDevice) {
  return {
    device,
    dtype: PRIVACY_FILTER_DTYPE,
  } as const;
}

export const PRIVACY_FILTER_INFERENCE_OPTIONS = {
  ignore_labels: [],
  aggregation_strategy: 'simple',
} as const;
